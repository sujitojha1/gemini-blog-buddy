import datetime as dt
import logging
import random
import re
from functools import lru_cache
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from blog_scraper import ArticleLink, BlogSource, gather_article_links, load_sources
from fastapi.concurrency import run_in_threadpool

from rag_pipeline import index_url as index_with_docling
from rag_pipeline import search_index as search_with_faiss
from update_blogs_md import (
    BLOGS_MD_PATH,
    parse_existing_sections,
    update_blogs_md as refresh_blogs_md,
)


app = FastAPI(title="Gemini Blog Buddy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


LOGGER = logging.getLogger(__name__)

DEFAULT_RANDOM_RESPONSE = {
    "message": "Here is a placeholder blog from your recent reads.",
    "url": "https://blog.example.com/placeholder-post"
}


@lru_cache(maxsize=1)
def get_blog_sources() -> tuple[BlogSource, ...]:
    return tuple(load_sources())


class SearchRequest(BaseModel):
    query: str
    top_k: int | None = None


class IndexRequest(BaseModel):
    url: str


ARTICLE_PATTERN = re.compile(
    r"^- \[(?P<title>.+?)\]\((?P<url>https?://[^\s)]+)\)\s+[—-]\s+\*(?P<source>.+?)\*\s*$"
)


def _load_recent_articles(max_articles: int = 50) -> tuple[str | None, list[ArticleLink]]:
    sections = parse_existing_sections(BLOGS_MD_PATH)
    if not sections:
        return None, []

    latest_date, lines = sections[0]
    articles: list[ArticleLink] = []

    for raw_line in lines:
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("- _("):
            continue

        match = ARTICLE_PATTERN.match(stripped)
        if not match:
            continue

        title = match.group("title").replace("\\[", "[").replace("\\]", "]").strip()
        url = match.group("url")
        source = match.group("source").strip()

        articles.append(
            ArticleLink(
                url=url,
                source_name=source,
                source_url="",
                anchor_text=title or url
            )
        )

        if len(articles) >= max_articles:
            break

    return latest_date, articles


def _is_section_stale(date_str: str | None) -> bool:
    if not date_str:
        return True
    try:
        section_date = dt.date.fromisoformat(date_str)
    except ValueError:
        return True

    today = dt.datetime.now(dt.timezone.utc).date()
    return section_date < today


async def _ensure_fresh_markdown(needs_refresh: bool) -> None:
    if not needs_refresh:
        return
    try:
        await run_in_threadpool(refresh_blogs_md, BLOGS_MD_PATH)
    except Exception as exc:  # noqa: BLE001
        LOGGER.warning("blogs.md refresh failed: %s", exc)


@app.get("/")
async def healthcheck():
    return {"message": "Gemini Blog Buddy API is running."}


@app.post("/index")
async def index_current_page(request: IndexRequest):
    try:
        result = await run_in_threadpool(index_with_docling, request.url)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "message": "Indexed document via Docling and FAISS.",
        "doc_name": result["doc_name"],
        "chunks_indexed": result["chunks_indexed"],
    }


@app.get("/random-blog")
async def random_blog():
    latest_date, recent_articles = _load_recent_articles()
    needs_refresh = _is_section_stale(latest_date) or not recent_articles
    await _ensure_fresh_markdown(needs_refresh)

    if needs_refresh:
        latest_date, recent_articles = _load_recent_articles()

    links = recent_articles
    pulled_from_history = bool(links)

    if not links:
        sources = get_blog_sources()
        links = await gather_article_links(sources)

    if not links:
        return DEFAULT_RANDOM_RESPONSE

    selected = random.choice(links)
    host = urlparse(selected.source_url or selected.url).netloc or selected.source_name
    prefix = "Surfaced a recently saved article" if pulled_from_history else "Surfaced an article"
    return {
        "message": f"{prefix} from {host}.",
        "url": selected.url
    }


@app.post("/search")
async def search_index(request: SearchRequest):
    try:
        top_k = request.top_k or 3
        results = await run_in_threadpool(search_with_faiss, request.query, top_k)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"query": request.query, "top_k": top_k, "results": results}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
