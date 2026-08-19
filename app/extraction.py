"""
Turns unstructured trial protocol text into the structured TrialCriteria
schema (see models.py) using whichever LLM backend utils/llm_provider.py
resolves — Ollama (gpt-oss:20b by default) if reachable, else Groq if
GROQ_API_KEY is set, else the legacy LM Studio fallback. Same provider chain
as extract_rules.py and research_assistant.py, so a friend running this with
only a GROQ_API_KEY in .env gets the same behavior as someone running Ollama.

Deliberate design choice: this module ONLY does unstructured -> structured
extraction. It never decides eligibility — that stays in matching_engine.py
as plain deterministic rules, so every eligibility decision is reproducible
and auditable.

Reliability for a live demo: if no LLM provider is reachable, or the model
output fails to parse, we fall back to the `fallback_criteria` already
embedded in data/trials.json instead of crashing mid-demo. Swap in a live
call whenever you want to show the "AI extraction" step live; the fallback
is what keeps the rest of the app usable regardless.

TODO(claude-code): if you add real PDF upload, extract text with PyMuPDF
first (pip install pymupdf), then pass that text into extract_criteria().
"""

import json
from models import TrialCriteria

EXTRACTION_SYSTEM_PROMPT = """You convert clinical trial eligibility protocols into structured JSON.

Return ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:

{
  "age": {"min": <int or null>, "max": <int or null>},
  "sex": [<"Male"|"Female"|"Other">, ...] or null,
  "diagnosis": {"required_any": [<string>, ...]},
  "labs": {"<lab_name_snake_case>": {"min": <float or null>, "max": <float or null>}, ...},
  "medications": {"required_any": [<string>, ...], "excluded": [<string>, ...]},
  "exclusion_flags": [<string_snake_case>, ...]
}

Rules:
- Only include a field if the protocol actually specifies it; use empty lists/objects otherwise.
- Normalize lab names to snake_case (e.g. "HbA1c" -> "hba1c", "eGFR" -> "egfr").
- exclusion_flags are boolean conditions that DISQUALIFY a patient if true (e.g. "pregnant", "active_malignancy").
- Do not invent criteria that are not stated in the text.
- Output must be valid JSON parseable by json.loads with no surrounding text."""


def _call_llm(raw_protocol_text: str) -> dict:
    from utils.llm_provider import resolve_provider, get_llm_client, get_llm_model

    provider = resolve_provider()
    client = get_llm_client()
    kwargs = {"extra_body": {"reasoning_effort": "low"}} if provider == "ollama" else {}
    resp = client.chat.completions.create(
        model=get_llm_model(),
        temperature=0,
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": raw_protocol_text},
        ],
        **kwargs,
    )
    raw = resp.choices[0].message.content.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(raw)


def extract_criteria(raw_protocol_text: str, fallback: dict | None = None) -> TrialCriteria:
    """
    Try a live LLM extraction; fall back to pre-baked structured criteria
    (from trials.json) if anything goes wrong, so a flaky API never breaks
    the demo. Prints a short note either way so it's obvious in the terminal
    which path was used.
    """
    try:
        data = _call_llm(raw_protocol_text)
        print("[extraction] used live LLM extraction")
        return TrialCriteria(**data)
    except Exception as e:  # noqa: BLE001 - demo-safety fallback is intentional
        print(f"[extraction] live extraction failed ({e}); using fallback criteria")

    if fallback is not None:
        return TrialCriteria(**fallback)

    raise RuntimeError(
        "No LLM provider reachable (Ollama/Groq/LM Studio) and no fallback criteria provided for this trial."
    )
