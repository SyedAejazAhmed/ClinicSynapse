"""
Resolves which OpenAI-compatible LLM backend the RAG/OCR pipeline
(extract_rules.py, cleaner.py) talks to.

Auto-detection order (override with LLM_PROVIDER=ollama|groq|lm_studio):
  1. Ollama running locally, with OLLAMA_MODEL pulled  -> used automatically
  2. Groq API (GROQ_API_KEY set)                        -> fallback
  3. LM Studio (legacy LLM_BASE_URL/LLM_API_KEY/LLM_MODEL) -> last resort

Env vars:
  OLLAMA_BASE_URL   (default: http://localhost:11434)
  OLLAMA_MODEL      (default: gpt-oss:20b)
  GROQ_API_KEY
  GROQ_BASE_URL     (default: https://api.groq.com/openai/v1)
  GROQ_MODEL        (default: llama-3.3-70b-versatile)
  LLM_BASE_URL / LLM_API_KEY / LLM_MODEL   (LM Studio fallback, unchanged)
  LLM_PROVIDER      force a specific backend instead of auto-detecting
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from functools import lru_cache

from openai import OpenAI

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gpt-oss:20b")

GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

LM_STUDIO_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:1234/v1")
LM_STUDIO_API_KEY = os.getenv("LLM_API_KEY", "lm-studio")
LM_STUDIO_MODEL = os.getenv("LLM_MODEL", "google/gemma-4-e4b")

FORCED_PROVIDER = os.getenv("LLM_PROVIDER", "").strip().lower()


def _ollama_has_model(model: str, timeout: float = 1.5) -> bool:
    """True if an Ollama server is reachable and `model` (or a same-family tag) is pulled."""
    try:
        with urllib.request.urlopen(f"{OLLAMA_BASE_URL}/api/tags", timeout=timeout) as resp:
            tags = json.loads(resp.read().decode())
        names = {m.get("name", "") for m in tags.get("models", [])}
        family = model.split(":")[0]
        return any(n == model or n.startswith(f"{family}:") for n in names)
    except (urllib.error.URLError, OSError, ValueError, TimeoutError):
        return False


@lru_cache(maxsize=1)
def resolve_provider() -> str:
    """Decide once per process which backend to use: 'ollama' | 'groq' | 'lm_studio'."""
    if FORCED_PROVIDER in ("ollama", "groq", "lm_studio"):
        return FORCED_PROVIDER

    if _ollama_has_model(OLLAMA_MODEL):
        return "ollama"

    if GROQ_API_KEY:
        return "groq"

    return "lm_studio"


def get_llm_client() -> OpenAI:
    provider = resolve_provider()
    if provider == "ollama":
        return OpenAI(api_key="ollama", base_url=f"{OLLAMA_BASE_URL}/v1")
    if provider == "groq":
        return OpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)
    return OpenAI(api_key=LM_STUDIO_API_KEY, base_url=LM_STUDIO_BASE_URL)


def get_llm_model() -> str:
    provider = resolve_provider()
    if provider == "ollama":
        return OLLAMA_MODEL
    if provider == "groq":
        return GROQ_MODEL
    return LM_STUDIO_MODEL
