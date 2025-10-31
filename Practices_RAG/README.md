# RAG Practice Notes

## Basics of text embedding
Text embedding models map natural language to fixed-length vector representations, placing semantically similar text near each other in the embedding space. This has made them a popular choice for tasks like semantic similarity, information retrieval, and clustering.

## embeddings.py
Generates a semantic embedding for your text using Gemini’s embedding model, optimized for storing as a retrieval document vector.

## embeddings_ollama.py
Generate local text embeddings using Ollama with the Nomic-Embed-Text model for offline semantic search, retrieval, and RAG applications — no API key or cloud required.