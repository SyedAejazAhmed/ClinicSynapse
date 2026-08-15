import re

from utils.llm_provider import get_llm_client, get_llm_model

def clean_ocr_text(raw_text: str) -> str:
    """Remove obvious OCR noise using regex (no LLM)."""
    lines = raw_text.split("\n")
    cleaned = []
    phone_re = re.compile(r"^[\d\s\-+()]{7,}$")
    email_re = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")

    for line in lines:
        line = line.strip()
        if not line:
            continue
        if phone_re.match(line):
            continue
        if email_re.match(line):
            continue
        if len(line) < 3:
            continue
        cleaned.append(line)

    text = "\n".join(cleaned)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text

import os
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# LLM backend: resolved by utils/llm_provider.py — Ollama (gpt-oss:20b) if
# running locally, else Groq, else LM Studio. See that module's docstring
# for the env vars that control it.

LLM_CLEANING_SYSTEM_PROMPT = """You are given raw text extracted from a scanned PDF via OCR. The text is noisy and contains many irrelevant lines (site addresses, phone numbers, emails, administrative metadata, etc.). Your job is to clean and reformat the text while preserving ALL meaningful content.

STRICT RULES:
1. Do NOT add, remove, or change any factual information. Only fix OCR errors (e.g., "thantwoweeks" -> "than two weeks"), remove obvious noise (phone numbers, email addresses, repeated headers), and improve spacing/punctuation.
2. Remove lines that are clearly not part of the document's main content (e.g., contact tables, investigator lists, addresses) UNLESS they could be relevant to a reader asking questions about the document. If unsure, keep them.
3. Do NOT summarise or paraphrase. Output the cleaned text as continuous prose, preserving the original order and meaning.
4. Return only the cleaned text, with no commentary, no markdown, no code fences.
"""

def clean_ocr_text_with_llm(raw_text: str, chunk_size: int = 15000) -> str:
    """
    Use an LLM to clean the OCR text. Splits into chunks to avoid context limits.
    """
    client = get_llm_client()
    model = get_llm_model()

    # Split raw text into manageable chunks (if needed)
    text_chunks = []
    start = 0
    while start < len(raw_text):
        end = start + chunk_size
        text_chunks.append(raw_text[start:end])
        start = end

    cleaned_parts = []
    for chunk in text_chunks:
        response = client.chat.completions.create(
            model=model,
            temperature=0,
            messages=[
                {"role": "system", "content": LLM_CLEANING_SYSTEM_PROMPT},
                {"role": "user", "content": f"Clean the following OCR text:\n\n{chunk}"},
            ],
        )
        cleaned_parts.append(response.choices[0].message.content.strip())

    return "\n\n".join(cleaned_parts)