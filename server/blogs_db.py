import asyncio
import datetime as dt
import re
from pathlib import Path
from typing import Dict, List, Tuple
import duckdb

from blog_scraper import ArticleLink, gather_links_from_config

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "blogs.duckdb"
BLOGS_MD_PATH = BASE_DIR / "blogs.md"
SOURCES_YAML_PATH = BASE_DIR / "blog_sources.yaml"

ARTICLE_PATTERN = re.compile(
    r"^- \[(?P<title>.+?)\]\((?P<url>https?://[^\s)]+)\)\s+[—-]\s+\*(?P<source>.+?)\*\s*$"
)
DATE_HEADING_PATTERN = re.compile(r"^##\s+(\d{4}-\d{2}-\d{2})\s*$")


def get_connection() -> duckdb.DuckDBPyConnection:
    conn = duckdb.connect(str(DB_PATH))
    conn.execute('''
        CREATE TABLE IF NOT EXISTS articles (
            url VARCHAR PRIMARY KEY,
            title VARCHAR,
            source_name VARCHAR,
            source_url VARCHAR,
            published_date DATE
        )
    ''')
    return conn


def _parse_existing_sections(path: Path) -> List[Tuple[str, List[str]]]:
    if not path.exists():
        return []

    sections: List[Tuple[str, List[str]]] = []
    current_date: str | None = None
    current_lines: List[str] = []

    with path.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.rstrip("\n")
            heading_match = DATE_HEADING_PATTERN.match(line)
            if heading_match:
                if current_date is not None:
                    sections.append((current_date, current_lines))
                current_date = heading_match.group(1)
                current_lines = []
                continue

            if current_date is not None:
                if line.strip():
                    current_lines.append(line)

        if current_date is not None:
            sections.append((current_date, current_lines))

    return sections


def migrate_from_md_if_needed():
    if not BLOGS_MD_PATH.exists():
        return
        
    conn = get_connection()
    count = conn.execute("SELECT count(*) FROM articles").fetchone()[0]
    if count == 0:
        sections = _parse_existing_sections(BLOGS_MD_PATH)
        for date_str, lines in sections:
            for line in lines:
                stripped = line.strip()
                match = ARTICLE_PATTERN.match(stripped)
                if match:
                    title = match.group("title").replace("\\[", "[").replace("\\]", "]").strip()
                    url = match.group("url")
                    source = match.group("source").strip()
                    
                    conn.execute('''
                        INSERT OR IGNORE INTO articles (url, title, source_name, source_url, published_date)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (url, title, source, "", date_str))
                    
        # Rename the md file to indicate migration
        try:
            BLOGS_MD_PATH.rename(BLOGS_MD_PATH.with_suffix(".md.migrated"))
        except OSError:
            pass
            
    conn.close()


def get_latest_date() -> str | None:
    conn = get_connection()
    res = conn.execute("SELECT MAX(published_date) FROM articles").fetchone()
    conn.close()
    if res and res[0]:
        return res[0].isoformat()
    return None


def get_recent_articles(max_articles: int = 50) -> tuple[str | None, List[ArticleLink]]:
    migrate_from_md_if_needed()
    latest_date = get_latest_date()
    if not latest_date:
        return None, []

    conn = get_connection()
    rows = conn.execute('''
        SELECT url, title, source_name, source_url 
        FROM articles 
        WHERE published_date = ? 
        LIMIT ?
    ''', (latest_date, max_articles)).fetchall()
    conn.close()
    
    articles = []
    for row in rows:
        articles.append(ArticleLink(
            url=row[0],
            anchor_text=row[1],
            source_name=row[2],
            source_url=row[3]
        ))
    return latest_date, articles


async def collect_articles() -> List[ArticleLink]:
    articles = await gather_links_from_config(sources_path=SOURCES_YAML_PATH)
    return articles


def save_articles(articles: List[ArticleLink], date_str: str) -> dict:
    migrate_from_md_if_needed()
    conn = get_connection()
    
    added = 0
    total_today = 0
    
    for article in articles:
        title = article.anchor_text.strip() or article.url
        try:
            res = conn.execute('''
                INSERT INTO articles (url, title, source_name, source_url, published_date)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (url) DO NOTHING
            ''', (article.url, title, article.source_name, article.source_url, date_str))
        except Exception:
            pass

    res = conn.execute("SELECT COUNT(*) FROM articles WHERE published_date = ?", (date_str,)).fetchone()
    if res:
        total_today = res[0]
        
    conn.close()
    
    return {
        "fetched": len(articles),
        "total_today": total_today
    }


def update_blogs_db(*args, **kwargs) -> Dict[str, int]:
    """Replaces update_blogs_md for integration with the job runner."""
    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    articles = asyncio.run(collect_articles())
    return save_articles(articles, today)

if __name__ == "__main__":
    stats = update_blogs_db()
    print("Updated blogs DB:", stats)
