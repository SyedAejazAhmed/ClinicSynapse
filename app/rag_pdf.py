"""
FAISS-based RAG over scanned PDF content (cleaned OCR text).

Pipeline options:
  1. extract_text_from_scanned_pdf()       -- OCR
  2a. clean_ocr_text()                     -- rule-based noise removal (fast)
  2b. clean_ocr_text_with_llm()            -- LLM-based cleaning (better, slower)
  3. chunk_text()                          -- split into overlapping chunks
  4. build_faiss_index()                   -- embed with sentence-transformers and save
  5. query_faiss_index()                   -- retrieve top-k chunks for a query

LLM cleaning (step 2b) is resolved by utils/llm_provider.py — Ollama with
gpt-oss:20b if running locally, else Groq, else LM Studio. See that
module's docstring for the env vars that control it.
"""

from __future__ import annotations

import os

import sys
from pathlib import Path

from sentence_transformers import SentenceTransformer

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# ---------------------------------------------------------------------------
# Build FAISS index (single PDF or folder)
# ---------------------------------------------------------------------------
from utils.build_index import build_faiss_index_from_pdf, build_index_from_pdf_folder

# ---------------------------------------------------------------------------
# Query (unchanged)
# ---------------------------------------------------------------------------
from utils.query_index import query_faiss_index

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  build:  python rag_pdf.py build <pdf_file_or_folder> [index_dir]")
        print("  query:  python rag_pdf.py query \"<query>\" [index_dir] [k]")
        raise SystemExit(1)

    mode = sys.argv[1]

    if mode == "build":
        path = sys.argv[2]
        index_dir = sys.argv[3] if len(sys.argv) > 3 else "rag_index"
        if Path(path).is_dir():
            build_index_from_pdf_folder(path, index_dir, use_llm_cleaning=True)
        else:
            build_faiss_index_from_pdf(path, index_dir, use_llm_cleaning=True)

    elif mode == "query":
        query = sys.argv[2]
        index_dir = sys.argv[3] if len(sys.argv) > 3 else "rag_index"
        k = int(sys.argv[4]) if len(sys.argv) > 4 else 5
        results = query_faiss_index(query, index_dir, k)
        for i, res in enumerate(results, 1):
            print(f"\n--- Result {i} (score: {res['score']:.4f}) ---")
            print(res["text"])
            print(f"Source: {res['pdf_path']}")

    else:
        print(f"Unknown mode: {mode}")
        raise SystemExit(1)