"""
Utilities for retrieving article links from curated blog sources.
"""

from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence
from urllib.parse import urljoin, urlparse

import httpx
import yaml
from bs4 import BeautifulSoup


LOGGER = logging.getLogger(__name__)

DEFAULT_SOURCES_PATH = Path(__file__).with_name("blog_sources.yaml")

ARTICLE_KEYWORDS: tuple[str, ...] = (
    "ai",
    "ml",
    "llm",
    "blog",
    "post",
    "article",
    "agent",
    "technology",
    "research",
    "generative",
    "model",
    "machine-learning"
)

EXCLUDE_PATTERNS: tuple[str, ...] = (
    "/about",
    "/careers",
    "/category",
    "/contact",
    "/privacy",
    "/terms",
    "/topic",
    "/topics",
    "/author",
    "/tag",
    "/podcast",
    "/video",
    "/press",
    "/jobs"
)

EXCLUDE_EXTENSIONS: tuple[str, ...] = (
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
    ".pdf",
    ".xml",
    ".json",
    ".zip",
    ".mp3",
    ".mp4"
)

MAX_LINKS_PER_SOURCE = 12
MAX_TOTAL_LINKS = 60
USER_AGENT = "GeminiBlogBuddy/0.1 (+https://github.com/)"


@dataclass(frozen=True)
class BlogSource:
    name: str
    url: str


@dataclass(frozen=True)
class ArticleLink:
    url: str
    source_name: str
    source_url: str
    anchor_text: str


def load_sources(path: Path | None = None) -> List[BlogSource]:
    """Load blog sources from a YAML configuration."""
    sources_path = path or DEFAULT_SOURCES_PATH
    if not sources_path.exists():
        raise FileNotFoundError(f"Blog sources file not found: {sources_path}")

    with sources_path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}

    items = data.get("sources", [])
    sources: List[BlogSource] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        url = item.get("url")
        if not name or not url:
            continue
        sources.append(BlogSource(name=name.strip(), url=url.strip()))

    if not sources:
        raise ValueError(f"No sources configured in {sources_path}")

    return sources


def _looks_like_article(path: str) -> bool:
    lowered = path.lower()
    if not lowered or lowered == "/":
        return False
    if any(lowered.endswith(ext) for ext in EXCLUDE_EXTENSIONS):
        return False
    if any(pattern in lowered for pattern in EXCLUDE_PATTERNS):
        return False
    return any(keyword in lowered for keyword in ARTICLE_KEYWORDS)


def _extract_anchor_text(anchor) -> str:
    text = anchor.get_text(" ", strip=True) or ""
    normalized = " ".join(text.split())
    return normalized


async def _fetch_article_links_from_source(
    client: httpx.AsyncClient,
    source: BlogSource
) -> List[ArticleLink]:
    try:
        response = await client.get(source.url, timeout=15.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        LOGGER.warning("Failed to fetch source %s: %s", source.url, exc)
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    base_netloc = urlparse(source.url).netloc
    discovered: List[ArticleLink] = []
    seen: set[str] = set()

    for anchor in soup.find_all("a", href=True):
        if len(discovered) >= MAX_LINKS_PER_SOURCE:
            break

        href = anchor["href"].strip()
        if not href:
            continue

        absolute = urljoin(source.url, href)
        parsed = urlparse(absolute)

        if parsed.scheme not in {"http", "https"}:
            continue

        if not parsed.netloc or not parsed.netloc.endswith(base_netloc):
            continue

        if not _looks_like_article(parsed.path):
            continue

        normalized = absolute.split("#", 1)[0]
        if normalized in seen:
            continue

        seen.add(normalized)
        anchor_text = _extract_anchor_text(anchor)
        discovered.append(
            ArticleLink(
                url=normalized,
                source_name=source.name,
                source_url=source.url,
                anchor_text=anchor_text or source.name
            )
        )

    return discovered


async def gather_article_links(
    sources: Sequence[BlogSource],
    *,
    max_total: int = MAX_TOTAL_LINKS,
    shuffle: bool = True
) -> List[ArticleLink]:
    """Fetch article links from the provided sources."""
    headers = {"User-Agent": USER_AGENT}

    async with httpx.AsyncClient(
        headers=headers,
        follow_redirects=True
    ) as client:
        results = await asyncio.gather(
            *(_fetch_article_links_from_source(client, source) for source in sources),
            return_exceptions=True
        )

    collected: List[ArticleLink] = []
    for result in results:
        if isinstance(result, Exception):
            LOGGER.warning("Error while gathering links: %s", result)
            continue
        collected.extend(result)

    if shuffle:
        random.shuffle(collected)

    if max_total > 0:
        return collected[:max_total]
    return collected


async def gather_links_from_config(
    sources_path: Path | None = None,
    **kwargs
) -> List[ArticleLink]:
    sources = load_sources(sources_path)
    return await gather_article_links(sources, **kwargs)
