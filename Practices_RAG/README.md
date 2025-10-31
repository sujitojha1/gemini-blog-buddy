# RAG Practice Notes

## Gemini Embeddings Walkthrough
- Load environment variables with `dotenv` to access the `GEMINI_API_KEY`.
- Instantiate the `google.genai` client so you can call the hosted Gemini embedding model.
- Send a sample sentence (`"How does AlphaFold work?"`) to `embed_content` with the `RETRIEVAL_DOCUMENT` task type, which returns a semantic vector tuned for search and retrieval.
- Convert the returned embedding into a NumPy array for downstream similarity search experiments or storage.
- Inspect the vector length and the first few values to confirm the dimensionality and sanity-check the output before wiring it into FAISS or other vector indexes.

### Why this matters
This script validates that your environment is configured, that you can reach the Gemini embedding API, and that the embeddings are in a usable numeric form. With these checks in place, you can confidently move on to building retrieval pipelines, comparing models, and experimenting with vector databases in the rest of the practice exercises.
