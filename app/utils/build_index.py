from sentence_transformers import SentenceTransformer
from pathlib import Path
import os
import faiss
import numpy as np
import pickle

from utils.pdf_to_text import extract_text_from_scanned_pdf

EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# ---------------------------------------------------------------------------
# Rule-based cleaning (fast fallback)
# ---------------------------------------------------------------------------
from utils.cleaner import clean_ocr_text

# ---------------------------------------------------------------------------
# LLM-based cleaning
# ---------------------------------------------------------------------------
from utils.cleaner import clean_ocr_text_with_llm

# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------
from utils.chunker import chunk_text

def build_faiss_index_from_pdf(
    pdf_path: str | Path,
    index_dir: str | Path = "rag_index",
    embedding_model_name: str = EMBEDDING_MODEL_NAME,
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP,
    use_llm_cleaning: bool = False,
) -> None:
    """
    Extract text from a single PDF, clean (rule-based or LLM), chunk, embed, save.
    """
    pdf_path = Path(pdf_path)
    index_dir = Path(index_dir)
    index_dir.mkdir(parents=True, exist_ok=True)

    print(f"Extracting text from {pdf_path.name}...")
    raw_text = extract_text_from_scanned_pdf(pdf_path, scale=2.0)

    if use_llm_cleaning:
        print("Cleaning with LLM...")
        cleaned_text = clean_ocr_text_with_llm(raw_text)
    else:
        print("Cleaning with rule-based filters...")
        cleaned_text = clean_ocr_text(raw_text)

    print(f"Chunking into ~{chunk_size} chars with {chunk_overlap} overlap...")
    chunks = chunk_text(cleaned_text, chunk_size, chunk_overlap)
    if not chunks:
        raise RuntimeError("No chunks produced after cleaning.")

    print(f"Embedding {len(chunks)} chunks...")
    model = SentenceTransformer(embedding_model_name)
    embeddings = model.encode(chunks, normalize_embeddings=True, show_progress_bar=True)
    embeddings = np.array(embeddings, dtype=np.float32)

    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)

    faiss.write_index(index, str(index_dir / "faiss.index"))
    metadata = [{"chunk_id": i, "text": chunks[i], "pdf_path": str(pdf_path)} for i in range(len(chunks))]
    with open(index_dir / "metadata.pkl", "wb") as f:
        pickle.dump(metadata, f)

    print(f"Saved index to {index_dir / 'faiss.index'}")

def build_index_from_pdf_folder(
    pdf_folder: str | Path,
    index_dir: str | Path = "rag_index",
    embedding_model_name: str = EMBEDDING_MODEL_NAME,
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP,
    use_llm_cleaning: bool = False,
) -> None:
    """
    Build a single FAISS index over all PDFs in a folder.
    """
    pdf_folder = Path(pdf_folder)
    index_dir = Path(index_dir)
    index_dir.mkdir(parents=True, exist_ok=True)

    pdf_files = sorted(pdf_folder.glob("*.pdf"))
    if not pdf_files:
        raise FileNotFoundError(f"No PDF files found in {pdf_folder}")

    all_chunks = []
    all_metadata = []

    for pdf_path in pdf_files:
        print(f"\nProcessing {pdf_path.name}...")
        raw_text = extract_text_from_scanned_pdf(pdf_path, scale=2.0)
        if use_llm_cleaning:
            print("  Cleaning with LLM...")
            cleaned = clean_ocr_text_with_llm(raw_text)
        else:
            print("  Cleaning with rule-based filters...")
            cleaned = clean_ocr_text(raw_text)
        chunks = chunk_text(cleaned, chunk_size, chunk_overlap)
        print(f"  {len(chunks)} chunks")
        for chunk in chunks:
            all_chunks.append(chunk)
            all_metadata.append({
                "chunk_id": len(all_metadata),
                "text": chunk,
                "pdf_path": str(pdf_path),
            })

    if not all_chunks:
        raise RuntimeError("No chunks produced.")

    print(f"\nEmbedding {len(all_chunks)} total chunks...")
    model = SentenceTransformer(embedding_model_name)
    embeddings = model.encode(all_chunks, normalize_embeddings=True, show_progress_bar=True)
    embeddings = np.array(embeddings, dtype=np.float32)

    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)

    faiss.write_index(index, str(index_dir / "faiss.index"))
    with open(index_dir / "metadata.pkl", "wb") as f:
        pickle.dump(all_metadata, f)

    print(f"Index saved to {index_dir / 'faiss.index'}")