# Gemini Blog Buddy – FastAPI Scaffold

This directory hosts a placeholder FastAPI service that responds to the Chrome extension’s three actions (index, random blog, search) with static payloads. Use **uv** to manage the virtual environment and dependencies.

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
- `GET /random-blog` — returns a placeholder blog URL and message.
- `POST /search` — echoes the query and returns a mock search result list.

The Chrome extension communicates with these routes when you click the *Index*, *Blog*, and search buttons in the popup.
