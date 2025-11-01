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

from docling.datamodel import vlm_model_specs
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import VlmPipelineOptions
from docling.datamodel.pipeline_options_vlm_model import (
    AcceleratorDevice,
    InlineVlmOptions,
    InferenceFramework,
    ResponseFormat,
    TransformersModelType,
)
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.pipeline.vlm_pipeline import VlmPipeline


CHUNK_SIZE = 40
CHUNK_OVERLAP = 10
EMBED_MODEL = "nomic-embed-text"
OLLAMA_EMBEDDINGS_URL = "http://localhost:11434/api/embeddings"

BASE_DIR = Path(__file__).parent
DOCUMENTS_DIR = BASE_DIR / "documents"
INDEX_DIR = BASE_DIR / "faiss_index"
INDEX_FILE = INDEX_DIR / "index.faiss"
METADATA_FILE = INDEX_DIR / "metadata.json"


def ensure_directories() -> None:
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_DIR.mkdir(parents=True, exist_ok=True)


def slugify_url(url: str) -> str:
    """Create a filesystem-friendly slug from a URL."""
    safe = "".join(ch if ch.isalnum() else "-" for ch in url.lower())
    return "-".join(filter(None, safe.split("-")))[:120] or f"doc-{int(time.time())}"


DEFAULT_INLINE_PROMPT = (
    "Convert this page to markdown. Do not miss any text and only output the bare markdown!"
)


def _safe_float(value: str | None, default: float) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _parse_devices(value: str | None) -> list[AcceleratorDevice]:
    if not value:
        return [AcceleratorDevice.CPU]
    devices: list[AcceleratorDevice] = []
    for token in value.split(","):
        token = token.strip().upper()
        if not token:
            continue
        try:
            devices.append(AcceleratorDevice[token])
        except KeyError:
            continue
    return devices or [AcceleratorDevice.CPU]


def build_vlm_pipeline_options() -> VlmPipelineOptions:
    repo_id = os.getenv("DOCLING_VLM_REPO_ID")
    if repo_id:
        prompt = os.getenv("DOCLING_VLM_PROMPT", DEFAULT_INLINE_PROMPT)
        response_format_name = os.getenv("DOCLING_VLM_RESPONSE_FORMAT", "MARKDOWN").upper()
        inference_framework_name = os.getenv("DOCLING_VLM_FRAMEWORK", "TRANSFORMERS").upper()
        model_type_name = os.getenv(
            "DOCLING_VLM_MODEL_TYPE", "AUTOMODEL_VISION2SEQ"
        ).upper()

        response_format = getattr(ResponseFormat, response_format_name, ResponseFormat.MARKDOWN)
        inference_framework = getattr(
            InferenceFramework, inference_framework_name, InferenceFramework.TRANSFORMERS
        )
        model_type = getattr(
            TransformersModelType, model_type_name, TransformersModelType.AUTOMODEL_VISION2SEQ
        )

        scale = _safe_float(os.getenv("DOCLING_VLM_SCALE"), 2.0)
        temperature = _safe_float(os.getenv("DOCLING_VLM_TEMPERATURE"), 0.0)
        devices = _parse_devices(os.getenv("DOCLING_VLM_DEVICES"))

        inline_options = InlineVlmOptions(
            repo_id=repo_id,
            prompt=prompt,
            response_format=response_format,
            inference_framework=inference_framework,
            transformers_model_type=model_type,
            supported_devices=devices,
            scale=scale,
            temperature=temperature,
        )
        return VlmPipelineOptions(vlm_options=inline_options)

    spec_name = os.getenv("DOCLING_VLM_SPEC", "GRANITEDOCLING_MLX").upper()
    vlm_spec = getattr(vlm_model_specs, spec_name, vlm_model_specs.GRANITEDOCLING_MLX)
    return VlmPipelineOptions(vlm_options=vlm_spec)


def run_docling(url: str) -> Path:
    """Use the Docling Python API to export a webpage or document to Markdown."""
    ensure_directories()
    slug = slugify_url(url)
    timestamp = int(time.time())
    destination = DOCUMENTS_DIR / f"{slug}-{timestamp}.md"

    pipeline_options = build_vlm_pipeline_options()
    format_options = {
        InputFormat.PDF: PdfFormatOption(
            pipeline_cls=VlmPipeline,
            pipeline_options=pipeline_options,
        )
    }

    converter = DocumentConverter(format_options=format_options)

    try:
        result = converter.convert(source=url)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Docling conversion failed: {exc}") from exc

    doc = result.document
    if doc is None:
        raise RuntimeError("Docling conversion yielded no document content.")

    markdown = doc.export_to_markdown()
    if not markdown or not markdown.strip():
        raise RuntimeError("Docling conversion did not produce Markdown output.")

    destination.write_text(markdown, encoding="utf-8")
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

    def _load_index(self) -> faiss.Index | None:
        if INDEX_FILE.exists():
            return faiss.read_index(str(INDEX_FILE))
        return None

    def _persist(self) -> None:
        if self.index is None or self.index.ntotal == 0:
            if INDEX_FILE.exists():
                INDEX_FILE.unlink()
            self.metadata = []
            self._chunk_lookup = {}
            write_metadata([])
            return
        faiss.write_index(self.index, str(INDEX_FILE))
        write_metadata(self.metadata)
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
        new_metadata = []
        for idx, chunk in enumerate(chunks):
            new_metadata.append(
                {
                    "doc_name": doc_name,
                    "chunk": chunk,
                    "chunk_id": f"{markdown_path.stem}_{idx}",
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
            results.append(
                {
                    "rank": rank + 1,
                    "score": float(distances[0][rank]),
                    "chunk_id": match["chunk_id"],
                    "title": match.get("doc_name"),
                    "snippet": match.get("chunk"),
                    "url": match.get("source_url"),
                    "doc_path": match.get("doc_path"),
                }
            )
        return results


FAISS_STORE = FaissStore()


def index_url(url: str) -> dict[str, Any]:
    markdown_path = run_docling(url)
    return FAISS_STORE.add_document(markdown_path, source_url=url)


def search_index(query: str, k: int = 3) -> list[dict[str, Any]]:
    return FAISS_STORE.search(query, k=k)
