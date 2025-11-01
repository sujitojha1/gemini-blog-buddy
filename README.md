# RAG Application – Chrome Extension

## Objective
Deliver Gemini Blog Buddy: a retrieval-augmented Chrome extension that curates standout content on AI, LLMs, and agentic systems from read blog posts, captures what you read, and resurfaces it on demand for learning, research, or project inspiration.

## Blog Links
[Google AI Blog](https://blog.google/technology/ai/)
[NVIDIA Blog](https://developer.nvidia.com/blog)
[Amazon Blog](https://www.amazon.science/blog)
[Apple Research Blog](https://machinelearning.apple.com/research)
[Anthropic Engineering Blog](https://www.anthropic.com/engineering)
[Anthropic Research Blog](https://www.anthropic.com/research)
[Anthropic Transformer Circuti](https://transformer-circuits.pub/)


## Requirements
- Incorporate an MCP-based orchestration layer featuring the Agent, Perception, Memory, Action, and Decision components.
- Provide a JavaScript-based Chrome extension as the front-end experience.
- Implement a FastAPI backend that powers retrieval, orchestration, and response generation.

## High-Level Plan
- [x] Practice RAG basics in the practice folder and learn UV, install ollama, FAISS, and embeddings
- [x] Create a chrome extension in new folder and basic extension with button index the document and find the document with search text
- [x] Set up a FastAPI backend scaffold (server folder) that returns placeholder responses for extension actions
- [ ] Define data contracts and interaction flows for the MCP components.
- [ ] Build the FastAPI backend, including retrieval pipelines and orchestration logic.
- [ ] Implement the Chrome extension UI and background services.
- [ ] Integrate the extension with the backend and validate end-to-end behaviors.
- [ ] Add automated tests, deployment scripts, and user-facing documentation.

