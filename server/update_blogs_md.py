"""
Utility script for scraping blog posts and updating blogs.md with daily entries.

Usage:
    uv run python update_blogs_md.py
"""

from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import re
from pathlib import Path
from typing import Dict, List, Tuple

from blog_scraper import ArticleLink, gather_links_from_config

BLOGS_MD_PATH = Path(__file__).with_name("blogs.md")
SOURCES_YAML_PATH = Path(__file__).with_name("blog_sources.yaml")
CACHE_WINDOW = 2  # number of most recent date sections to treat as cache

DATE_HEADING_PATTERN = re.compile(r"^##\s+(\d{4}-\d{2}-\d{2})\s*$")
LINK_PATTERN = re.compile(r"\((https?://[^\s)]+)\)")


def parse_existing_sections(path: Path) -> List[Tuple[str, List[str]]]:
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


def extract_links_from_lines(lines: List[str]) -> List[str]:
    links: List[str] = []
    for line in lines:
        match = LINK_PATTERN.search(line)
        if match:
            links.append(match.group(1))
    return links


def build_cache(existing_sections: List[Tuple[str, List[str]]]) -> set[str]:
    cache: set[str] = set()
    for _, lines in existing_sections[:CACHE_WINDOW]:
        cache.update(extract_links_from_lines(lines))
    return cache


def format_article(article: ArticleLink) -> str:
    title = article.anchor_text.strip() or article.url
    # Escape brackets to avoid breaking markdown
    safe_title = title.replace("[", "\\[").replace("]", "\\]")
    return f"- [{safe_title}]({article.url}) — *{article.source_name}*"


def render_markdown(
    new_date: str,
    new_lines: List[str],
    existing_sections: List[Tuple[str, List[str]]]
) -> str:
    lines: List[str] = []

    lines.append(f"## {new_date}")
    lines.extend(new_lines or ["- _(no new articles discovered)_"])
    lines.append("")  # blank line after section

    for date, section_lines in existing_sections:
        if date == new_date:
            continue
        lines.append(f"## {date}")
        lines.extend(section_lines or ["- _(no articles recorded)_"])
        lines.append("")

    # Remove trailing blank line for neatness
    while lines and lines[-1] == "":
        lines.pop()

    return "\n".join(lines) + "\n"


async def collect_articles() -> List[ArticleLink]:
    articles = await gather_links_from_config(sources_path=SOURCES_YAML_PATH)
    return articles


def merge_with_cache(
    articles: List[ArticleLink],
    existing_today_links: List[str],
    cache: set[str]
) -> List[str]:
    existing_urls = set(extract_links_from_lines(existing_today_links))
    combined_urls = cache | existing_urls

    deduped: List[str] = []

    for article in articles:
        if article.url in combined_urls:
            continue
        deduped.append(format_article(article))
        combined_urls.add(article.url)

    # Place newly fetched articles on top, followed by previous entries for today
    if existing_today_links:
        deduped.extend(existing_today_links)

    return deduped


def update_blogs_md(output_path: Path = BLOGS_MD_PATH) -> Dict[str, int]:
    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    existing_sections = parse_existing_sections(output_path)
    cache = build_cache(existing_sections)

    existing_today_lines: List[str] = []
    if existing_sections and existing_sections[0][0] == today:
        existing_today_lines = existing_sections[0][1]

    articles = asyncio.run(collect_articles())
    formatted_today = merge_with_cache(articles, existing_today_lines, cache)

    markdown = render_markdown(today, formatted_today, existing_sections)
    output_path.write_text(markdown, encoding="utf-8")

    return {
        "fetched": len(articles),
        "added": len(formatted_today) - len(existing_today_lines),
        "total_today": len(formatted_today)
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch article links and update blogs.md."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=BLOGS_MD_PATH,
        help="Path to blogs.md (default: server/blogs.md)"
    )
    args = parser.parse_args()

    stats = update_blogs_md(args.output)
    print(
        "Updated blogs.md with {added} new articles "
        "(today total: {total_today}, fetched: {fetched}).".format(**stats)
    )


if __name__ == "__main__":
    main()
