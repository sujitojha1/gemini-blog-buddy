# Gemini Blog Buddy – FastAPI Scaffold

This directory hosts a FastAPI service that responds to the Chrome extension’s three actions (index, random blog, search). Use **uv** to manage the virtual environment and dependencies.

## Quickstart

```bash
cd server
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
uv run uvicorn main:app --reload
```

The app listens on `http://localhost:8000`. The following endpoints are available:

- `POST /index` — returns a static JSON message pretending to process the current page.
- `GET /random-blog` — scrapes the curated source blogs, selects a random article, and returns its URL.
- `POST /search` — echoes the query and returns a mock search result list.

The Chrome extension communicates with these routes when you click the *Index*, *Blog*, and search buttons in the popup.

## Daily blog harvest
The blog list lives in `blog_sources.yaml`. To scrape the configured sites and update `blogs.md` with a dated list of newly discovered articles (deduplicated against the last two recorded days), run:

```bash
uv run python update_blogs_md.py
```

The script prepends today’s date section with bullet links (most recent dates at the top). If no new articles are found, the existing entries remain untouched.
