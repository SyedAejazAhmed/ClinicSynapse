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
from pathlib import Path
import urllib.error
import urllib.request
from urllib.parse import urlparse, urlunparse

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


def _is_placeholder_secret(value: str) -> bool:
    v = (value or "").strip().lower()
    if not v:
        return True
    return v in {"gsk_...", "your_key_here", "changeme", "replace_me"}


def _looks_localhost(url: str) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        return False
    return host in {"localhost", "127.0.0.1"}


def _running_in_container() -> bool:
    return Path("/.dockerenv").exists()


def _with_host(url: str, host: str) -> str:
    parsed = urlparse(url)
    if not parsed.scheme:
        return url
    port = parsed.port
    netloc = f"{host}:{port}" if port else host
    return urlunparse(parsed._replace(netloc=netloc))


def _ollama_candidate_base_urls() -> list[str]:
    """Prefer the configured URL, but in Docker also probe host.docker.internal
    when configured URL points at localhost (which resolves to the container
    itself, not the host running Ollama)."""
    urls = [OLLAMA_BASE_URL]
    if _running_in_container() and _looks_localhost(OLLAMA_BASE_URL):
        urls.append(_with_host(OLLAMA_BASE_URL, "host.docker.internal"))
        # Common Docker bridge gateway on Linux when host.docker.internal
        # isn't available in a deployment environment.
        urls.append(_with_host(OLLAMA_BASE_URL, "172.17.0.1"))
    # preserve order while deduplicating
    return list(dict.fromkeys(urls))


def _ollama_has_model(base_url: str, model: str, timeout: float = 1.5) -> bool:
    """True if an Ollama server is reachable and `model` (or a same-family tag) is pulled."""
    try:
        with urllib.request.urlopen(f"{base_url}/api/tags", timeout=timeout) as resp:
            tags = json.loads(resp.read().decode())
        names = {m.get("name", "") for m in tags.get("models", [])}
        family = model.split(":")[0]
        return any(n == model or n.startswith(f"{family}:") for n in names)
    except (urllib.error.URLError, OSError, ValueError, TimeoutError):
        return False


def resolve_ollama_base_url() -> str | None:
    for base_url in _ollama_candidate_base_urls():
        if _ollama_has_model(base_url, OLLAMA_MODEL):
            return base_url
    return None


def resolve_provider() -> str:
    """Resolve backend dynamically: 'ollama' | 'groq' | 'lm_studio'."""
    if FORCED_PROVIDER in ("ollama", "groq", "lm_studio"):
        return FORCED_PROVIDER

    if resolve_ollama_base_url() is not None:
        return "ollama"

    if not _is_placeholder_secret(GROQ_API_KEY):
        return "groq"

    return "lm_studio"


def get_llm_client() -> OpenAI:
    provider = resolve_provider()
    if provider == "ollama":
        # Resolve per call so a backend that starts later can be picked up
        # without restarting the API process.
        base_url = resolve_ollama_base_url() or OLLAMA_BASE_URL
        return OpenAI(api_key="ollama", base_url=f"{base_url}/v1")
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
