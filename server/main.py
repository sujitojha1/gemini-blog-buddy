from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(title="Gemini Blog Buddy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class SearchRequest(BaseModel):
    query: str


@app.get("/")
async def healthcheck():
    return {"message": "Gemini Blog Buddy API is running."}


@app.post("/index")
async def index_current_page():
    return {
        "message": "Pretending to process the current page for indexing.",
        "status": "indexed-placeholder"
    }


@app.get("/random-blog")
async def random_blog():
    return {
        "message": "Here is a placeholder blog from your recent reads.",
        "url": "https://blog.example.com/placeholder-post"
    }


@app.post("/search")
async def search_index(request: SearchRequest):
    return {
        "message": f"Pretending to search for '{request.query}'.",
        "results": [
            {
                "title": "Static search result",
                "snippet": "This is a placeholder snippet returned from the FastAPI backend."
            }
        ]
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
