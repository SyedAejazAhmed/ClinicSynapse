"""
Phase 2 — RAG Research Assistant.

Answers natural-language research questions against the current CTRI trial
+ synthetic patient dataset (app/data/*.json), following the hybrid pattern
from the architecture brief:

    question -> intent check -> STRUCTURED aggregate query (labs, counts)
                              -> or SEMANTIC retrieval + LLM synthesis

Never lets the LLM invent numbers: aggregate/statistical questions ("average
HbA1c", "how many patients") are always answered by direct computation over
the raw dataset (see _structured_lab_answer). The LLM is only used to
narrate retrieved evidence snippets for qualitative questions, and every
answer carries `sources` pointing back to the patient/trial records used —
same evidence-first convention as matching_engine.py.

LLM synthesis tries, in order: a local Ollama model (gpt-oss:20b by default —
see app/utils/llm_provider.py) if Ollama is actually reachable with that
model pulled, then the Anthropic API if ANTHROPIC_API_KEY is set, then an
extractive summary of the retrieved snippets. Nothing here ever raises —
every step degrades to the next instead of erroring, mirroring extraction.py's
"never let the fallback break" rule.
If sentence-transformers/faiss aren't importable (e.g. no internet to fetch
the embedding model), semantic retrieval falls back to keyword overlap.
"""

import json
import os
import re
from collections import defaultdict
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

# ---------------------------------------------------------------------------
# Raw dataset + derived indexes (built lazily, cached in-process)
# ---------------------------------------------------------------------------
_RAW_PATIENTS: list[dict] = []
_RAW_TRIALS: list[dict] = []
_TRIAL_BY_ID: dict[str, dict] = {}
_LAB_META: dict[str, dict] = {}           # lab_code -> {"display", "unit"}
_PATIENT_LABS: dict[str, dict] = {}       # lab_code -> {patient_id: value} (most recent)
_PATIENT_DIAG_TEXT: dict[str, str] = {}   # patient_id -> lowercased diagnosis text

_DOC_META: list[dict] = []                # [{"id", "type", "text"}, ...]
_DOC_EMB = None                           # numpy array aligned with _DOC_META, or None
_EMBED_MODEL = None
_SEMANTIC_OK = False
_LOADED = False


def _load_raw_data() -> None:
    global _RAW_PATIENTS, _RAW_TRIALS, _TRIAL_BY_ID, _LAB_META
    global _PATIENT_LABS, _PATIENT_DIAG_TEXT, _LOADED

    with open(DATA_DIR / "patients.json") as f:
        _RAW_PATIENTS = json.load(f)
    with open(DATA_DIR / "trials.json") as f:
        _RAW_TRIALS = json.load(f)
    _TRIAL_BY_ID = {t["id"]: t for t in _RAW_TRIALS}

    lab_meta: dict[str, dict] = {}
    lab_values: dict[str, dict[str, tuple]] = defaultdict(dict)  # code -> {pid: (value, date)}
    diag_text: dict[str, str] = {}

    for p in _RAW_PATIENTS:
        pid = p["id"]
        diag_text[pid] = " ".join(d.get("display", "").lower() for d in p.get("diagnoses", []))
        for lab in p.get("labs", []):
            code = lab.get("code")
            value = lab.get("value")
            if not code or value is None:
                continue
            lab_meta.setdefault(code, {"display": lab.get("display", code), "unit": lab.get("unit", "")})
            date = lab.get("date", "")
            existing = lab_values[code].get(pid)
            if existing is None or date >= existing[1]:
                lab_values[code][pid] = (value, date)

    _LAB_META = lab_meta
    _PATIENT_LABS = {code: {pid: v for pid, (v, _d) in pid_map.items()} for code, pid_map in lab_values.items()}
    _PATIENT_DIAG_TEXT = diag_text
    _LOADED = True


def _patient_doc(p: dict) -> str:
    dg = p.get("demographics", {})
    parts = [f"Patient {p['id']}: {dg.get('age')} year old {dg.get('sex')}, "
             f"{dg.get('race', '')} {dg.get('ethnicity', '')}.".strip()]
    for d in p.get("diagnoses", []):
        parts.append(f"Diagnosis: {d.get('display')} ({d.get('code')}, {d.get('system')}), "
                      f"recorded {d.get('recorded_date')}.")
    for lab in p.get("labs", []):
        parts.append(f"Lab: {lab.get('display')} = {lab.get('value')} {lab.get('unit')} "
                      f"on {lab.get('date')} ({lab.get('code')}).")
    for m in p.get("medications", []):
        parts.append(f"Medication: {m.get('display')} ({m.get('status')}), started {m.get('start_date')}.")
    for proc in p.get("procedures", []):
        parts.append(f"Procedure: {proc}")
    sh = p.get("social_history", {})
    if sh:
        parts.append(f"Social history: smoking {sh.get('smoking_status')}, alcohol {sh.get('alcohol_use')}.")
    return " ".join(parts)


def _trial_doc(t: dict) -> str:
    parts = [f"Trial {t['id']}: {t.get('title')} ({t.get('phase')}). "
             f"Condition: {', '.join(t.get('condition', []))}. "
             f"Intervention: {', '.join(t.get('intervention', []))}."]
    elig = t.get("eligibility", {})
    for c in elig.get("inclusion", []):
        parts.append(f"Inclusion criterion: {c.get('text')}")
    for c in elig.get("exclusion", []):
        parts.append(f"Exclusion criterion: {c.get('text')}")
    return " ".join(parts)


def _build_corpus() -> list[dict]:
    docs = [{"id": p["id"], "type": "record", "text": _patient_doc(p)} for p in _RAW_PATIENTS]
    docs += [{"id": t["id"], "type": "document", "text": _trial_doc(t)} for t in _RAW_TRIALS]
    return docs


def ensure_index_built(force: bool = False) -> None:
    """Build (or rebuild) the in-memory corpus + semantic index. Cheap enough
    (dozens of docs) to call eagerly on startup; also safe to call lazily on
    first request if startup skipped it."""
    global _DOC_META, _DOC_EMB, _EMBED_MODEL, _SEMANTIC_OK

    if not force and _LOADED and _DOC_META:
        return

    _load_raw_data()
    _DOC_META = _build_corpus()

    try:
        from sentence_transformers import SentenceTransformer
        import numpy as np

        if _EMBED_MODEL is None:
            _EMBED_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
        emb = _EMBED_MODEL.encode([d["text"] for d in _DOC_META], normalize_embeddings=True)
        _DOC_EMB = np.asarray(emb, dtype="float32")
        _SEMANTIC_OK = True
    except Exception as e:  # offline / model not cached / lib missing
        print(f"[research_assistant] semantic embeddings unavailable ({e}); using keyword fallback")
        _DOC_EMB = None
        _SEMANTIC_OK = False


# ---------------------------------------------------------------------------
# Structured path — numeric/aggregate questions answered by direct computation,
# never by the LLM.
# ---------------------------------------------------------------------------
_TRIGGER_WORDS = (
    "average", "avg", "mean", "median", "distribution", "how many",
    "count", "minimum", "maximum", "min ", "max ", "range",
)

_SYNONYMS = {
    "a1c": "hemoglobin a1c glycated",
    "hba1c": "hemoglobin a1c glycated",
    "kidney function": "glomerular filtration rate egfr",
    "egfr": "glomerular filtration rate",
    "blood sugar": "glucose",
    "cholesterol": "ldl cholesterol lipid",
}


def _expand_synonyms(question: str) -> str:
    ql = question.lower()
    extra = [v for k, v in _SYNONYMS.items() if k in ql]
    return ql + " " + " ".join(extra)


def _find_lab_code(question: str) -> str | None:
    ql = _expand_synonyms(question)
    q_words = set(re.findall(r"[a-z0-9]+", ql))
    best_code, best_score = None, 0
    for code, meta in _LAB_META.items():
        display_words = [w for w in re.split(r"[^a-z0-9]+", meta["display"].lower()) if len(w) > 2]
        score = sum(1 for w in display_words if w in q_words)
        if score > best_score:
            best_score, best_code = score, code
    return best_code if best_score > 0 else None


def _detect_structured_lab_query(question: str) -> str | None:
    ql = f" {question.lower()} "
    if not any(t in ql for t in _TRIGGER_WORDS):
        return None
    return _find_lab_code(question)


def _cohort_for_study(study_id: str | None) -> set[str] | None:
    if not study_id:
        return None
    trial = _TRIAL_BY_ID.get(study_id)
    if not trial:
        return None
    conditions = [c.lower() for c in trial.get("condition", [])]
    if not conditions:
        return None
    matched = {pid for pid, txt in _PATIENT_DIAG_TEXT.items() if any(c in txt for c in conditions)}
    return matched or None


def _structured_lab_answer(lab_code: str, study_id: str | None) -> dict:
    meta = _LAB_META[lab_code]
    cohort = _cohort_for_study(study_id)
    pid_values = _PATIENT_LABS.get(lab_code, {})
    values = [(pid, v) for pid, v in pid_values.items() if cohort is None or pid in cohort]

    if not values:
        return {
            "answer": f"No {meta['display']} lab values found for the selected cohort.",
            "points": [],
            "basedOn": "Based on 0 matching lab records.",
            "sources": [],
        }

    nums = [v for _, v in values]
    trial = _TRIAL_BY_ID.get(study_id) if study_id else None
    cohort_note = f" for patients matching {trial['title']}" if trial else " across all patients"

    return {
        "answer": f"{meta['display']}{cohort_note} — {len(values)} patient record(s):",
        "points": [
            f"Mean — {sum(nums) / len(nums):.2f} {meta['unit']}",
            f"Min — {min(nums):.2f} {meta['unit']}",
            f"Max — {max(nums):.2f} {meta['unit']}",
            f"N patients — {len(values)}",
        ],
        "basedOn": f"Based on {len(values)} lab record(s) from the current dataset "
                   f"(most recent value per patient, computed directly — not LLM-estimated).",
        "sources": [{"id": pid, "label": f"Patient {pid}", "type": "record"} for pid, _ in values[:5]],
    }


# ---------------------------------------------------------------------------
# Semantic path — retrieval + (optional) LLM synthesis for qualitative questions.
# ---------------------------------------------------------------------------
def _keyword_search(question: str, docs: list[dict], k: int) -> list[dict]:
    q_words = set(re.findall(r"[a-z0-9]+", question.lower()))
    scored = []
    for d in docs:
        d_words = re.findall(r"[a-z0-9]+", d["text"].lower())
        score = sum(1 for w in d_words if w in q_words)
        if score > 0:
            scored.append((score, d))
    scored.sort(key=lambda x: -x[0])
    return [d for _, d in scored[:k]] or docs[:k]


def _retrieve(question: str, study_id: str | None, k: int = 6) -> list[dict]:
    ensure_index_built()

    idxs = list(range(len(_DOC_META)))
    if study_id:
        trial = _TRIAL_BY_ID.get(study_id)
        if trial:
            conditions = [c.lower() for c in trial.get("condition", [])]
            filtered = []
            for i, d in enumerate(_DOC_META):
                if d["id"] == study_id:
                    filtered.append(i)
                    continue
                if d["type"] == "record" and any(c in _PATIENT_DIAG_TEXT.get(d["id"], "") for c in conditions):
                    filtered.append(i)
            if filtered:
                idxs = filtered

    subset = [_DOC_META[i] for i in idxs]

    if not _SEMANTIC_OK:
        return _keyword_search(question, subset, k)

    import numpy as np
    q_emb = _EMBED_MODEL.encode([question], normalize_embeddings=True)[0]
    sub_emb = _DOC_EMB[idxs]
    sims = sub_emb @ q_emb
    order = np.argsort(-sims)[:k]
    return [subset[j] for j in order]


def _extractive_summary(hits: list[dict]) -> tuple[str, list[str]]:
    answer = "Relevant evidence retrieved from the current dataset (set ANTHROPIC_API_KEY or run Ollama for a narrative summary):"
    points = [h["text"][:180] + ("…" if len(h["text"]) > 180 else "") for h in hits[:5]]
    return answer, points


_SYNTH_SYSTEM_PROMPT = (
    "You are a clinical research assistant supporting authorized researchers. "
    "Answer ONLY using the numbered evidence snippets provided — never invent "
    "values not present in them. You must never diagnose, prescribe, or make an "
    "eligibility determination; you are summarizing existing research data for "
    "human review. Respond with strict JSON only, no markdown fences, no other "
    'text: {"answer": "<one sentence lead-in>", "points": ["<finding 1>", "<finding 2>"]}'
)


def _parse_llm_json(raw: str) -> tuple[str | None, list[str] | None]:
    raw = re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    parsed = json.loads(raw)
    answer = (parsed.get("answer") or "").strip() or None
    points = parsed.get("points") or None
    return answer, points


def _synthesize_ollama(question: str, evidence: str) -> tuple[str | None, list[str] | None]:
    """Local-first synthesis via Ollama (gpt-oss:20b by default). Returns
    (None, None) if Ollama isn't actually reachable with the model pulled, so
    callers can fall through to the next provider without erroring."""
    try:
        from utils.llm_provider import resolve_provider, get_llm_client, get_llm_model

        if resolve_provider() != "ollama":
            return None, None

        client = get_llm_client()
        resp = client.chat.completions.create(
            model=get_llm_model(),
            temperature=0,
            messages=[
                {"role": "system", "content": _SYNTH_SYSTEM_PROMPT},
                {"role": "user", "content": f"Question: {question}\n\nEvidence:\n{evidence}"},
            ],
        )
        return _parse_llm_json(resp.choices[0].message.content)
    except Exception as e:
        print(f"[research_assistant] Ollama synthesis failed, trying next provider: {e}")
        return None, None


def _synthesize_anthropic(question: str, evidence: str) -> tuple[str | None, list[str] | None]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None, None
    try:
        import anthropic

        client = anthropic.Anthropic()
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            system=_SYNTH_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Question: {question}\n\nEvidence:\n{evidence}"}],
        )
        return _parse_llm_json(resp.content[0].text)
    except Exception as e:
        print(f"[research_assistant] Anthropic synthesis failed, using extractive fallback: {e}")
        return None, None


_STREAM_SYSTEM_PROMPT = (
    "You are a clinical research assistant supporting authorized researchers. "
    "Answer ONLY using the numbered evidence snippets provided — never invent "
    "values not present in them. You must never diagnose, prescribe, or make an "
    "eligibility determination; you are summarizing existing research data for "
    "human review. Write a concise, plain-prose answer (2-4 sentences). No "
    "markdown, no JSON, no bullet points — plain sentences only."
)


def stream_llm_answer(question: str, hits: list[dict]):
    """Yields answer text chunks as they're generated, for a live-typing UI.
    Same provider order as _synthesize (Ollama -> Anthropic -> extractive),
    but falls through to the next provider only if the current one produced
    no output at all — once a provider has started streaming text, the
    response commits to it rather than restarting mid-stream."""
    evidence = "\n".join(f"[{i + 1}] ({h['type']} {h['id']}) {h['text']}" for i, h in enumerate(hits))

    try:
        from utils.llm_provider import resolve_provider, get_llm_client, get_llm_model

        if resolve_provider() == "ollama":
            client = get_llm_client()
            stream = client.chat.completions.create(
                model=get_llm_model(),
                temperature=0,
                stream=True,
                messages=[
                    {"role": "system", "content": _STREAM_SYSTEM_PROMPT},
                    {"role": "user", "content": f"Question: {question}\n\nEvidence:\n{evidence}"},
                ],
            )
            got_any = False
            for chunk in stream:
                text = chunk.choices[0].delta.content
                if text:
                    got_any = True
                    yield text
            if got_any:
                return
    except Exception as e:
        print(f"[research_assistant] Ollama streaming failed, trying next provider: {e}")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        try:
            import anthropic

            client = anthropic.Anthropic()
            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=400,
                system=_STREAM_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": f"Question: {question}\n\nEvidence:\n{evidence}"}],
            ) as stream:
                got_any = False
                for text in stream.text_stream:
                    got_any = True
                    yield text
                if got_any:
                    return
        except Exception as e:
            print(f"[research_assistant] Anthropic streaming failed, using extractive fallback: {e}")

    answer, _points = _extractive_summary(hits)
    yield answer


def _synthesize(question: str, hits: list[dict]) -> dict:
    if not hits:
        return {
            "answer": "No matching records or trial documents were found for this question in the current dataset.",
            "points": [],
            "basedOn": "Based on 0 matching records.",
            "sources": [],
        }

    evidence = "\n".join(f"[{i + 1}] ({h['type']} {h['id']}) {h['text']}" for i, h in enumerate(hits))

    provider_used = None
    answer, points = _synthesize_ollama(question, evidence)
    if answer is not None and points is not None:
        provider_used = "Ollama (gpt-oss:20b)"
    else:
        answer, points = _synthesize_anthropic(question, evidence)
        if answer is not None and points is not None:
            provider_used = "Anthropic Claude"

    if answer is None or points is None:
        answer, points = _extractive_summary(hits)

    sources = [
        {"id": h["id"], "label": f"{'Trial' if h['type'] == 'document' else 'Patient'} {h['id']}", "type": h["type"]}
        for h in hits
    ]
    return {
        "answer": answer,
        "points": points,
        "basedOn": f"Based on {len(hits)} matching record(s)/document(s) from the current dataset "
                   f"(semantic retrieval{f' + LLM synthesis via {provider_used}' if provider_used else ''}).",
        "sources": sources,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def answer_research_question(question: str, study_id: str | None = None) -> dict:
    ensure_index_built()

    lab_code = _detect_structured_lab_query(question)
    if lab_code:
        return _structured_lab_answer(lab_code, study_id)

    hits = _retrieve(question, study_id)
    return _synthesize(question, hits)
