# Gemini Blog Buddy – FastAPI Scaffold

This directory hosts a FastAPI service that responds to the Chrome extension’s three actions (index, random blog, search). Use **uv** to manage the virtual environment and dependencies.

## Quickstart

```bash
cd server
uv venv
source .venv/bin/activate
uv pip install -e .
uv run uvicorn main:app --reload
```

The app listens on `http://localhost:8000`. The following endpoints are available:

- `POST /index` — runs Docling’s VLM pipeline via the Python API (Granite Docling by default, configurable via env vars), saves the Markdown in `server/documents/`, and updates the FAISS index in `server/faiss_index/`.
- `GET /random-blog` — scrapes the curated source blogs, selects a random article, and returns its URL.
- `POST /search` — performs a FAISS similarity search over the indexed chunks using Ollama embeddings.

The Chrome extension communicates with these routes when you click the *Index*, *Blog*, and search buttons in the popup.

> **Pre-reqs:** Start Ollama locally with the `nomic-embed-text` model available, and install Docling via `uv pip install docling`. The indexing pipeline uses Docling’s Python API with `VlmPipeline`; environment variables such as `DOCLING_VLM_SPEC`, `DOCLING_VLM_REPO_ID`, and `DOCLING_VLM_PROMPT` adjust the model and prompt. Ollama must respond on `http://localhost:11434`.

## Daily blog harvest
The blog list lives in `blog_sources.yaml`. To scrape the configured sites and update `blogs.md` with a dated list of newly discovered articles (deduplicated against the last two recorded days), run:

```bash
uv run python update_blogs_md.py
```

The script prepends today’s date section with bullet links (most recent dates at the top). If no new articles are found, the existing entries remain untouched.
