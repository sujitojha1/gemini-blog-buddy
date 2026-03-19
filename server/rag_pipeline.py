import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import faiss  # type: ignore
import numpy as np
import requests
import networkx as nx

import trafilatura


CHUNK_SIZE = 40
CHUNK_OVERLAP = 10
EMBED_MODEL = "nomic-embed-text"
OLLAMA_EMBEDDINGS_URL = "http://localhost:11434/api/embeddings"

BASE_DIR = Path(__file__).parent
DOCUMENTS_DIR = BASE_DIR / "documents"
INDEX_DIR = BASE_DIR / "faiss_index"
INDEX_FILE = INDEX_DIR / "index.faiss"
METADATA_FILE = INDEX_DIR / "metadata.json"
GRAPH_FILE = INDEX_DIR / "knowledge_graph.graphml"


def ensure_directories() -> None:
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_DIR.mkdir(parents=True, exist_ok=True)


def slugify_url(url: str) -> str:
    """Create a filesystem-friendly slug from a URL."""
    safe = "".join(ch if ch.isalnum() else "-" for ch in url.lower())
    return "-".join(filter(None, safe.split("-")))[:120] or f"doc-{int(time.time())}"


def run_trafilatura(url: str) -> Path:
    """Use Trafilatura to extract a webpage to text."""
    ensure_directories()
    slug = slugify_url(url)
    timestamp = int(time.time())
    destination = DOCUMENTS_DIR / f"{slug}-{timestamp}.md"
    
    downloaded = trafilatura.fetch_url(url)
    if downloaded is None:
        raise RuntimeError(f"Trafilatura fetch failed for URL: {url}")
        
    text = trafilatura.extract(downloaded)
    if not text or not text.strip():
        raise RuntimeError("Trafilatura extraction did not produce output.")
         
    destination.write_text(text, encoding="utf-8")
    return destination


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    if not words:
        return chunks
    step = max(size - overlap, 1)
    for start in range(0, len(words), step):
        chunk = " ".join(words[start:start + size])
        if chunk:
            chunks.append(chunk)
    return chunks


def get_embedding(text: str) -> np.ndarray:
    response = requests.post(
        OLLAMA_EMBEDDINGS_URL,
        json={"model": EMBED_MODEL, "prompt": text},
        timeout=30,
    )
    response.raise_for_status()
    embedding = response.json()["embedding"]
    return np.array(embedding, dtype=np.float32)


def read_metadata() -> list[dict[str, Any]]:
    if not METADATA_FILE.exists():
        return []
    return json.loads(METADATA_FILE.read_text(encoding="utf-8"))


def write_metadata(metadata: Sequence[dict[str, Any]]) -> None:
    METADATA_FILE.write_text(json.dumps(list(metadata), indent=2), encoding="utf-8")


@dataclass
class ChunkRecord:
    chunk_id: str
    doc_name: str
    chunk: str
    source_url: str
    doc_path: str | None = None


class FaissStore:
    def __init__(self) -> None:
        ensure_directories()
        self.metadata: list[dict[str, Any]] = read_metadata()
        self._chunk_lookup: dict[str, dict[str, Any]] = {
            entry["chunk_id"]: entry for entry in self.metadata if "chunk_id" in entry
        }
        self.index = self._load_index()
        self.graph = self._load_graph()

    def _load_index(self) -> faiss.Index | None:
        if INDEX_FILE.exists():
            return faiss.read_index(str(INDEX_FILE))
        return None

    def _load_graph(self) -> nx.DiGraph:
        if GRAPH_FILE.exists():
            return nx.read_graphml(str(GRAPH_FILE))
        return nx.DiGraph()

    def _persist(self) -> None:
        if self.index is None or self.index.ntotal == 0:
            if INDEX_FILE.exists():
                INDEX_FILE.unlink()
            if GRAPH_FILE.exists():
                GRAPH_FILE.unlink()
            self.metadata = []
            self._chunk_lookup = {}
            self.graph = nx.DiGraph()
            write_metadata([])
            return
        faiss.write_index(self.index, str(INDEX_FILE))
        write_metadata(self.metadata)
        if self.graph is not None:
            nx.write_graphml(self.graph, str(GRAPH_FILE))
        self._chunk_lookup = {
            entry["chunk_id"]: entry for entry in self.metadata if "chunk_id" in entry
        }

    def add_document(self, markdown_path: Path, source_url: str) -> dict[str, Any]:
        text = markdown_path.read_text(encoding="utf-8")
        chunks = chunk_text(text)
        if not chunks:
            raise ValueError("Document produced no chunks for indexing.")

        embeddings = [get_embedding(chunk) for chunk in chunks]
        dimension = embeddings[0].shape[0]

        embedding_matrix = np.stack(embeddings)
        if self.index is None:
            self.index = faiss.IndexFlatL2(dimension)
        elif self.index.d != dimension:
            raise ValueError(
                f"Embedding dimension mismatch. Expected {self.index.d}, got {dimension}."
            )

        self.index.add(embedding_matrix)

        doc_name = markdown_path.name
        try:
            doc_path = str(markdown_path.relative_to(BASE_DIR))
        except ValueError:
            doc_path = str(markdown_path)
            
        doc_node_id = f"doc_{markdown_path.stem}"
        if not self.graph.has_node(doc_node_id):
            self.graph.add_node(doc_node_id, type="Document", url=source_url, name=doc_name)

        new_metadata = []
        prev_chunk_id = None
        for idx, chunk in enumerate(chunks):
            chunk_id = f"{markdown_path.stem}_{idx}"
            
            self.graph.add_node(chunk_id, type="Chunk", text=chunk)
            self.graph.add_edge(doc_node_id, chunk_id, relation="HAS_CHUNK")
            if prev_chunk_id is not None:
                self.graph.add_edge(prev_chunk_id, chunk_id, relation="NEXT_CHUNK")
            prev_chunk_id = chunk_id

            new_metadata.append(
                {
                    "doc_name": doc_name,
                    "chunk": chunk,
                    "chunk_id": chunk_id,
                    "source_url": source_url,
                    "doc_path": doc_path,
                }
            )
        self.metadata.extend(new_metadata)
        for entry in new_metadata:
            self._chunk_lookup[entry["chunk_id"]] = entry
        self._persist()
        return {
            "doc_name": doc_name,
            "chunks_indexed": len(chunks),
            "metadata_entries": new_metadata,
        }

    def search(self, query: str, k: int = 3) -> list[dict[str, Any]]:
        if self.index is None or self.index.ntotal == 0:
            return []

        query_vec = get_embedding(query).reshape(1, -1)
        distances, indices = self.index.search(query_vec, k=k)
        results: list[dict[str, Any]] = []
        for rank, idx in enumerate(indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                continue
            match = self.metadata[idx]
            chunk_id = match["chunk_id"]

            graph_neighbors = []
            if self.graph.has_node(chunk_id):
                preds = [str(n) for n in self.graph.predecessors(chunk_id)]
                succs = [str(n) for n in self.graph.successors(chunk_id)]
                graph_neighbors = preds + succs

            results.append(
                {
                    "rank": rank + 1,
                    "score": float(distances[0][rank]),
                    "chunk_id": chunk_id,
                    "title": match.get("doc_name"),
                    "snippet": match.get("chunk"),
                    "url": match.get("source_url"),
                    "doc_path": match.get("doc_path"),
                    "graph_neighbors": graph_neighbors,
                }
            )
        return results


FAISS_STORE = FaissStore()


def index_url(url: str) -> dict[str, Any]:
    markdown_path = run_trafilatura(url)
    return FAISS_STORE.add_document(markdown_path, source_url=url)


def search_index(query: str, k: int = 3) -> list[dict[str, Any]]:
    return FAISS_STORE.search(query, k=k)
