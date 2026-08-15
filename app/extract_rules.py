"""
Rule extraction from scanned PDFs using local OCR + LLM.

Pipeline:
  1. OCR: uses `extract_rules.extract_text_from_scanned_pdf` (RapidOCR + pypdfium2)
     to convert scanned PDF pages into raw text locally.
  2. LLM: sends the OCR text to whichever backend `utils/llm_provider.py`
     resolves (Ollama with gpt-oss:20b if running locally, else Groq, else
     LM Studio) via the OpenAI-compatible API, with strict
     anti-hallucination instructions.

Environment variables: see utils/llm_provider.py docstring (OLLAMA_MODEL,
GROQ_API_KEY, LLM_BASE_URL/LLM_API_KEY/LLM_MODEL for the LM Studio fallback,
or LLM_PROVIDER to force one backend).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from utils.llm_provider import get_llm_client, get_llm_model
from utils.pdf_to_text import extract_text_from_scanned_pdf

MAX_CHARS_TO_LLM = 60000   # safety cap on OCR text sent per extraction

# ---------------------------------------------------------------------------
# JSON output template — the LLM is instructed to fill exactly this shape.
# ---------------------------------------------------------------------------
RULES_JSON_TEMPLATE = {
    "id": "string, e.g., T101",
    "title": "string, trial title",
    "phase": "string, e.g., Phase 3",
    "condition": ["array of condition names"],
    "intervention": ["array of intervention names"],
    "eligibility": {
        "inclusion": [
            {
                "id": "string, e.g., INC-1",
                "category": "string, one of: demographics, diagnosis, lab, medication, condition, social_history",
                "text": "the rule in the document's own words",
                "structured": {
                    "type": "string, one of: age_range, diagnosis_required, lab_threshold, medication_required, condition_forbidden, smoking_forbidden",
                    # Additional fields depend on the type; include only if applicable:
                    # age_range: "min", "max"
                    # diagnosis_required: "codes" (ICD-10 codes), "systems" (e.g., ["ICD-10"]), "min_duration_months"
                    # lab_threshold: "code" (LOINC), "display", "operator", "value", "unit"
                    # medication_required: "codes" (RxNorm), "systems" (e.g., ["RxNorm"]), "min_duration_months"
                    # condition_forbidden: "keywords", "systems"
                    # smoking_forbidden: "forbidden_statuses"
                }
            }
        ],
        "exclusion": [
            # same structure as inclusion
        ]
    },
    "consent_required": "boolean",
    "source": {
        "clinicaltrials_gov_id": "string or null",
        "protocol_pdf_url": "string or null"
    }
}

EXTRACTION_SYSTEM_PROMPT = f"""You are a strict information-extraction engine. You will be given text parsed from a document (via OCR). A large majority of the text is irrelevant noise: site addresses, phone numbers, sponsor details, contact tables, administrative metadata, etc.

Your ONLY job is to find and extract the actual RULES stated in the document (eligibility/inclusion/exclusion criteria and similar explicit constraints) and return them as JSON matching the exact schema below.

STRICT ANTI-HALLUCINATION RULES — violating any of these is a critical failure:
1. Extract ONLY information explicitly and literally present in the provided text. Never infer, guess, complete, or "fill in" a rule that is not written in the text.
2. Do not use outside/world knowledge to add, correct, or embellish a rule, even if you believe you know what it "should" say.
3. Every rule you output MUST include a "source_evidence" field containing a short snippet copied from the input text that justifies that rule. If you cannot find supporting text, do not output the rule.
4. If OCR noise makes a phrase ambiguous or garbled, either skip it or include it with the exact garbled wording — never "clean it up" into something you assume it means.
5. If NO rules can be found in the text at all, return an empty "rules" list and set "extraction_notes.rules_found" to false with a brief "no_rules_reason". Do NOT invent placeholder rules.
6. Respond with a single JSON object and nothing else — no explanation, no markdown, no code fences.
7. Follow the schema exactly — same keys, same nesting, no extra top-level keys.

JSON schema to fill (structure only, replace values with extracted data or null):
{json.dumps(RULES_JSON_TEMPLATE, indent=2)}
"""


def extract_text_from_pdf(pdf_path: str | Path, ocr_scale: float = 2.0) -> str:
    """Extract raw text from a scanned PDF using the local OCR module."""
    return extract_text_from_scanned_pdf(pdf_path, scale=ocr_scale)


def call_llm_for_rules(document_text: str) -> str:
    """Sends the OCR text to the LLM via the OpenAI-compatible API."""
    client = get_llm_client()
    model = get_llm_model()

    user_prompt = (
        "Below is text parsed from a document via OCR. Extract only the explicit "
        "rules/eligibility constraints as instructed, following the JSON "
        "schema exactly.\n\n"
        "=== DOCUMENT TEXT START ===\n"
        f"{document_text[:MAX_CHARS_TO_LLM]}\n"
        "=== DOCUMENT TEXT END ==="
    )

    # NOTE: No response_format parameter – not all local servers support it.
    response = client.chat.completions.create(
        model=model,
        temperature=0,   # deterministic, minimizes hallucination
        top_p=1,
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    return response.choices[0].message.content


def _strip_code_fences(text: str) -> str:
    """Remove Markdown code fences if the model wrapped JSON in them."""
    # Remove ```json ... ``` or ``` ... ```
    pattern = r"```(?:json)?\s*(.*?)```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()


def validate_and_normalize_json(raw_json_str: str) -> str:
    """
    Parses the LLM's rule-extraction output and validates its top-level shape.
    Falls back to a safe empty structure on failure.
    """
    cleaned = _strip_code_fences(raw_json_str)

    try:
        parsed = json.loads(cleaned)
        if not isinstance(parsed, dict):
            raise ValueError("Top-level JSON is not an object")
    except (json.JSONDecodeError, TypeError, ValueError):
        parsed = {
            "document_summary": {
                "title": None, "age_min": None, "age_max": None,
                "age_unit": None, "gender": None
            },
            "rules": [],
            "extraction_notes": {
                "rules_found": False,
                "no_rules_reason": "LLM did not return valid JSON."
            }
        }

    parsed.setdefault("document_summary", {})
    parsed.setdefault("rules", [])
    parsed.setdefault(
        "extraction_notes",
        {"rules_found": bool(parsed.get("rules")), "no_rules_reason": None}
    )

    return json.dumps(parsed, indent=2, ensure_ascii=False)


def process_pdf(pdf_path: str | Path) -> str:
    """End-to-end entry point: PDF path in -> validated rules JSON string out."""
    document_text = extract_text_from_pdf(pdf_path)

    if not document_text.strip():
        return json.dumps(
            {
                "document_summary": {
                    "title": None, "age_min": None, "age_max": None,
                    "age_unit": None, "gender": None
                },
                "rules": [],
                "extraction_notes": {
                    "rules_found": False,
                    "no_rules_reason": "OCR produced no text from the PDF."
                }
            },
            indent=2,
            ensure_ascii=False,
        )

    raw_response = call_llm_for_rules(document_text)
    return validate_and_normalize_json(raw_response)


if __name__ == "__main__":
    pdf_file = sys.argv[1] if len(sys.argv) > 1 else "sample.pdf"
    print(process_pdf(pdf_file))

"""

Usage as a module:
    from extract_rules import process_pdf
    rules_json_str = process_pdf("scanned_document.pdf")
    # The returned string is a JSON object matching the RULES_JSON_TEMPLATE schema.

"""