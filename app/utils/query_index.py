
from sentence_transformers import SentenceTransformer
from pathlib import Path
import os
import faiss
from typing import Any, Optional
import numpy as np
import pickle

from utils.pdf_to_text import extract_text_from_scanned_pdf

EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

def query_faiss_index(
    query: str,
    index_dir: str | Path = "rag_index",
    k: int = 5,
    embedding_model_name: str = EMBEDDING_MODEL_NAME,
) -> list[dict[str, Any]]:
    """Retrieve top-k chunks for a query."""
    index_dir = Path(index_dir)
    index_path = index_dir / "faiss.index"
    meta_path = index_dir / "metadata.pkl"

    if not index_path.exists() or not meta_path.exists():
        raise FileNotFoundError(f"Index not found at {index_dir}. Build first.")

    index = faiss.read_index(str(index_path))
    with open(meta_path, "rb") as f:
        metadata = pickle.load(f)

    model = SentenceTransformer(embedding_model_name)
    q_emb = model.encode([query], normalize_embeddings=True).astype(np.float32)

    scores, indices = index.search(q_emb, k)
    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx == -1:
            continue
        meta = metadata[idx]
        results.append({
            "score": float(score),
            "text": meta["text"],
            "chunk_id": meta["chunk_id"],
            "pdf_path": meta["pdf_path"],
        })
    return results