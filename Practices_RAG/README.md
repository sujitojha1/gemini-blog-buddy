# RAG Practice Notes

## Basics of text embedding
Text embedding models map natural language to fixed-length vector representations, placing semantically similar text near each other in the embedding space. This has made them a popular choice for tasks like semantic similarity, information retrieval, and clustering.

## embeddings.py
Generates a semantic embedding for your text using Gemini’s embedding model, optimized for storing as a retrieval document vector.

## embeddings_ollama.py
Generate local text embeddings using Ollama with the Nomic-Embed-Text model for offline semantic search, retrieval, and RAG applications — no API key or cloud required.

## embeddings_compare.py
Transform sentences into high-dimensional vectors and compute semantic similarity between them using cosine distance — showing how related their meanings are.
Converts cosine distance to cosine similarity (1 = identical meaning, 0 = no relation).

"How does AlphaFold work?" ↔ "How do proteins fold?" → similarity = 0.912
"How does AlphaFold work?" ↔ "What is the capital of France?" → similarity = 0.742
"How does AlphaFold work?" ↔ "Explain how neural networks learn." → similarity = 0.831
"How do proteins fold?" ↔ "What is the capital of France?" → similarity = 0.756
"How do proteins fold?" ↔ "Explain how neural networks learn." → similarity = 0.806
"What is the capital of France?" ↔ "Explain how neural networks learn." → similarity = 0.754
