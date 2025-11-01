## Backend Server (placeholder)
1. Create a virtual environment and install dependencies:
   ```bash
   cd server
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Start the FastAPI app with reload:
   ```bash
   uvicorn main:app --reload
   ```
3. The Chrome extension calls `http://localhost:8000/index`, `/random-blog`, and `/search`, each of which returns static JSON used to update the popup status.