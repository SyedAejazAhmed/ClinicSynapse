"""
Phase 2 — RAG Research Assistant.

Answers natural-language research questions against the current CTRI trial
+ synthetic patient dataset (app/data/*.json), following the hybrid pattern
from the architecture brief:

    question -> intent check -> STRUCTURED query (lab stats, diagnosis
                                 cohorts, trial-eligibility cohorts)
                              -> or SEMANTIC retrieval (FAISS) + LLM synthesis

Never lets the LLM invent facts. Three question shapes are answered by
direct computation, never retrieval-then-guess:
  - aggregate/statistical ("average HbA1c", "how many patients")
    -> _structured_lab_answer
  - "which/list patients with <diagnosis>"
    -> _diagnosis_cohort_answer (exact match against the diagnosis index)
  - "which patients are eligible for <trial>"
    -> _trial_cohort_answer, which reuses matching_engine.match_patient_to_trial
       — the SAME deterministic rule engine behind /api/match, not a guess
       from retrieved text. This is the fix for a real failure mode: asking
       "which patients qualify for trial X" is a structured cohort question,
       and answering it via vector retrieval + LLM synthesis can only ever
       surface the top-k semantically similar docs, not a complete, correct
       list — so it must never be answered that way.
Only genuinely open-ended/qualitative questions ("summarize adverse events")
fall through to semantic retrieval + LLM narration, and every answer still
carries `sources` pointing back to the patient/trial records used — same
evidence-first convention as matching_engine.py.

Semantic retrieval uses real sentence embeddings (all-MiniLM-L6-v2) indexed
with FAISS (IndexFlatIP over normalized vectors = exact cosine-similarity
search) — a genuine vector index, not a keyword hack. A minimum-similarity
threshold is enforced: if nothing in the corpus is actually relevant, we
return zero hits rather than padding the result with the top-k closest (but
irrelevant) docs — the earlier version did the latter, which is exactly why
asking about something absent from the dataset (e.g. a Phase-2 mock
"RS-0001" that was never in the real backend) could surface confident-looking
but unrelated sources next to a "not found" answer. Both the FAISS path and
the keyword fallback path now honor this: no relevant evidence -> empty
sources -> the frontend shows nothing rather than misleading citations.

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

from matching_engine import match_patient_to_trial
from models import Patient, Trial

DATA_DIR = Path(__file__).parent / "data"

_SEMANTIC_SIM_THRESHOLD = 0.12  # cosine similarity floor for a doc to count as relevant
# Empirically tuned against this corpus/model (all-MiniLM-L6-v2), not a hard
# guarantee: short clinical documents score lower than you'd expect even for
# genuinely relevant matches (e.g. "adverse events" questions land ~0.17
# against real adverse-event reports), while a clearly off-topic query
# ("weather forecast", "sci-fi novel plot") lands ~0.04-0.05. 0.12 sits
# between those two clusters. A domain-adjacent-but-irrelevant query
# ("hospital budget") can still slip through around ~0.2 — acceptable
# tradeoff at this scale; a production deployment with a larger, noisier
# corpus would need a cross-encoder reranker or a fine-tuned threshold per
# query type rather than one global cutoff.

# ---------------------------------------------------------------------------
# Raw dataset + derived indexes (built lazily, cached in-process)
# ---------------------------------------------------------------------------
_RAW_PATIENTS: list[dict] = []
_RAW_TRIALS: list[dict] = []
_RAW_STUDIES: list[dict] = []
_TRIAL_BY_ID: dict[str, dict] = {}
_STUDY_BY_ID: dict[str, dict] = {}
_LAB_META: dict[str, dict] = {}           # lab_code -> {"display", "unit"}
_PATIENT_LABS: dict[str, dict] = {}       # lab_code -> {patient_id: value} (most recent)
_PATIENT_DIAG_TEXT: dict[str, str] = {}   # patient_id -> lowercased diagnosis text
_DIAGNOSIS_INDEX: dict[str, set[str]] = {}  # lowercased diagnosis display -> {patient_id, ...}
_DIAGNOSIS_DISPLAYS_BY_LEN: list[str] = []  # unique diagnosis displays, longest first

_DOC_META: list[dict] = []                # [{"id", "type", "text"}, ...]
_DOC_EMB = None                           # numpy array aligned with _DOC_META, or None
_EMBED_MODEL = None
_SEMANTIC_OK = False
_LOADED = False


def _load_raw_data() -> None:
    global _RAW_PATIENTS, _RAW_TRIALS, _RAW_STUDIES, _TRIAL_BY_ID, _STUDY_BY_ID, _LAB_META
    global _PATIENT_LABS, _PATIENT_DIAG_TEXT, _DIAGNOSIS_INDEX, _DIAGNOSIS_DISPLAYS_BY_LEN, _LOADED

    with open(DATA_DIR / "patients.json") as f:
        _RAW_PATIENTS = json.load(f)
    with open(DATA_DIR / "trials.json") as f:
        _RAW_TRIALS = json.load(f)
    with open(DATA_DIR / "studies.json") as f:
        _RAW_STUDIES = json.load(f)
    _TRIAL_BY_ID = {t["id"]: t for t in _RAW_TRIALS}
    _STUDY_BY_ID = {s["id"]: s for s in _RAW_STUDIES}

    lab_meta: dict[str, dict] = {}
    lab_values: dict[str, dict[str, tuple]] = defaultdict(dict)  # code -> {pid: (value, date)}
    diag_text: dict[str, str] = {}
    diagnosis_index: dict[str, set[str]] = defaultdict(set)

    for p in _RAW_PATIENTS:
        pid = p["id"]
        diag_text[pid] = " ".join(d.get("display", "").lower() for d in p.get("diagnoses", []))
        for d in p.get("diagnoses", []):
            display = (d.get("display") or "").strip().lower()
            if display:
                diagnosis_index[display].add(pid)
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
    _DIAGNOSIS_INDEX = dict(diagnosis_index)
    _DIAGNOSIS_DISPLAYS_BY_LEN = sorted(_DIAGNOSIS_INDEX, key=len, reverse=True)
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


def _report_doc(study: dict, participant: dict, report: dict) -> dict:
    parts = [
        f"Daily report for {participant['research_subject_id']} (Patient {participant['patient_id']}) "
        f"in study {study['id']} on {report['date']}.",
        f"Blood glucose: {report['blood_glucose']} mg/dL.",
        f"Heart rate: {report['heart_rate']} bpm.",
        f"Blood pressure: {report['bp_systolic']}/{report['bp_diastolic']} mmHg.",
        f"Fatigue level: {report['fatigue']}.",
    ]
    if report.get("adverse_event"):
        parts.append(f"Adverse event reported: {report['adverse_event']}")
    if report.get("notes"):
        parts.append(report["notes"])
    return {
        "id": f"{participant['research_subject_id']}-{report['date']}",
        "type": "report",
        "text": " ".join(parts),
    }


def _build_corpus() -> list[dict]:
    docs = [{"id": p["id"], "type": "record", "text": _patient_doc(p)} for p in _RAW_PATIENTS]
    docs += [{"id": t["id"], "type": "document", "text": _trial_doc(t)} for t in _RAW_TRIALS]
    docs += [
        _report_doc(s, participant, report)
        for s in _RAW_STUDIES
        for participant in s.get("participants", [])
        for report in participant.get("reports", [])
    ]
    return docs


def ensure_index_built(force: bool = False) -> None:
    """Build (or rebuild) the in-memory corpus + FAISS vector index. Cheap
    enough (dozens of docs) to call eagerly on startup; also safe to call
    lazily on first request if startup skipped it."""
    global _DOC_META, _DOC_EMB, _EMBED_MODEL, _SEMANTIC_OK

    if not force and _LOADED and _DOC_META:
        return

    _load_raw_data()
    _DOC_META = _build_corpus()

    try:
        from sentence_transformers import SentenceTransformer
        import numpy as np
        import faiss  # noqa: F401 - import here to fail fast into the except below if missing

        if _EMBED_MODEL is None:
            _EMBED_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
        emb = _EMBED_MODEL.encode([d["text"] for d in _DOC_META], normalize_embeddings=True)
        _DOC_EMB = np.asarray(emb, dtype="float32")
        _SEMANTIC_OK = True
        print(f"[research_assistant] FAISS vector index ready: {len(_DOC_META)} docs, dim={_DOC_EMB.shape[1]}")
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

    # A real Study has an exact, authoritative enrolled-patient list — prefer
    # that over fuzzy condition-text matching whenever study_id is one.
    study = _STUDY_BY_ID.get(study_id)
    if study:
        return {p["patient_id"] for p in study.get("participants", [])} or None

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
# Structured path — cohort questions ("which patients have X", "which
# patients are eligible for trial Y") answered by exact lookup / the
# deterministic matching engine, never by retrieval + LLM guessing.
# ---------------------------------------------------------------------------
_COHORT_TRIGGER_WORDS = (
    "which patient", "list patient", "show patient", "patients with",
    "patients who", "patients diagnosed", "patients having",
    "who has", "who is diagnosed",
)

_ELIGIBILITY_TRIGGER_WORDS = (
    "eligible", "qualify", "qualifies", "available for", "who can join",
    "who can enroll", "screening for", "currently available",
)


def _detect_diagnosis_cohort_query(question: str) -> tuple[str, set[str]] | None:
    ql = question.lower()
    if not any(t in ql for t in _COHORT_TRIGGER_WORDS + _ELIGIBILITY_TRIGGER_WORDS):
        return None
    for display in _DIAGNOSIS_DISPLAYS_BY_LEN:
        if display in ql:
            return display, _DIAGNOSIS_INDEX[display]
    return None


def _diagnosis_cohort_answer(display: str, pids: set[str]) -> dict:
    ordered = sorted(pids)
    return {
        "answer": f"{len(ordered)} patient(s) have a recorded diagnosis of \"{display}\":",
        "points": [", ".join(ordered)] if ordered else ["No patients in the current dataset have this diagnosis."],
        "basedOn": f"Based on {len(ordered)} patient record(s) matched by exact diagnosis text "
                   f"(direct lookup against the diagnosis index — not LLM-estimated, not vector retrieval).",
        "sources": [{"id": pid, "label": f"Patient {pid}", "type": "record"} for pid in ordered[:10]],
    }


def _detect_trial_cohort_query(question: str) -> str | None:
    ql = question.lower()
    if not any(t in ql for t in _ELIGIBILITY_TRIGGER_WORDS):
        return None
    for trial in _RAW_TRIALS:  # match by internal id, e.g. "T101"
        if trial["id"].lower() in ql:
            return trial["id"]
    for trial in _RAW_TRIALS:  # match by the trial's own short code, e.g. "DIAB-2027"
        title_code = trial["title"].split(":")[0].strip().lower()
        if title_code and title_code in ql:
            return trial["id"]
    return None


def _trial_cohort_answer(trial_id: str) -> dict:
    """Deterministic — reuses matching_engine.match_patient_to_trial (the
    exact same rule engine behind /api/match) across every patient. This is
    the whole point: 'which patients qualify for trial X' is a structured
    question with one correct answer, not something to approximate from
    the top-k semantically similar documents."""
    trial_raw = _TRIAL_BY_ID[trial_id]
    trial = Trial(**trial_raw)
    results = [match_patient_to_trial(Patient(**p), trial) for p in _RAW_PATIENTS]

    eligible = sorted(r.patient_id for r in results if r.overall_status == "ELIGIBLE")
    review = sorted(r.patient_id for r in results if r.overall_status == "NEEDS_REVIEW")

    points = [f"Eligible ({len(eligible)}): {', '.join(eligible) if eligible else 'none'}"]
    if review:
        points.append(f"Needs review ({len(review)}): {', '.join(review)}")

    return {
        "answer": f"{len(eligible)} of {len(results)} screened patients are ELIGIBLE for {trial_id} "
                  f"({trial_raw.get('title', '')}); {len(review)} need human review.",
        "points": points,
        "basedOn": f"Based on the deterministic eligibility rule engine (matching_engine.match_patient_to_trial) "
                   f"run against all {len(results)} patients — the same rules used by /api/match, not an LLM guess.",
        "sources": [{"id": pid, "label": f"Patient {pid}", "type": "record"} for pid in (eligible + review)[:10]],
    }


def _detect_global_eligibility_query(question: str) -> bool:
    """'Which patients are ready for which trial' / 'who qualifies for a
    trial' — an eligibility question with no SPECIFIC trial named, so it
    can't be answered by _trial_cohort_answer. Answered by running the same
    deterministic engine across every trial instead of guessing from
    retrieved text."""
    ql = question.lower()
    if _detect_trial_cohort_query(question) is not None:
        return False  # a specific trial WAS named — let _trial_cohort_answer handle it
    return "trial" in ql and any(t in ql for t in ("ready", "eligible", "qualify", "qualifies"))


def _global_eligibility_answer() -> dict:
    by_trial: dict[str, list[str]] = {}
    for t in _RAW_TRIALS:
        trial = Trial(**t)
        eligible = sorted(
            p["id"] for p in _RAW_PATIENTS
            if match_patient_to_trial(Patient(**p), trial).overall_status == "ELIGIBLE"
        )
        if eligible:
            by_trial[t["id"]] = eligible

    if not by_trial:
        return {
            "answer": "No patients are currently ELIGIBLE for any trial in the dataset.",
            "points": [],
            "basedOn": "Based on the deterministic eligibility rule engine run across all patients x trials.",
            "sources": [],
        }

    points = [f"{tid}: {', '.join(pids)}" for tid, pids in sorted(by_trial.items())]
    total_pairs = sum(len(v) for v in by_trial.values())
    return {
        "answer": f"{len(by_trial)} of {len(_RAW_TRIALS)} trials currently have at least one ELIGIBLE patient "
                  f"({total_pairs} eligible patient-trial pairs total):",
        "points": points,
        "basedOn": f"Based on the deterministic eligibility rule engine (matching_engine.match_patient_to_trial) "
                   f"run across all {len(_RAW_PATIENTS)} patients x {len(_RAW_TRIALS)} trials — the same rules "
                   f"used by /api/match, not an LLM guess.",
        "sources": [{"id": tid, "label": f"Trial {tid}", "type": "document"} for tid in sorted(by_trial)[:10]],
    }


# ---------------------------------------------------------------------------
# Structured path — study-scoped questions ("who are the active
# participants", "how many reports today") answered by direct lookup against
# the enrolled Study record for the study_id the frontend is currently
# scoped to. Requires a real study_id — with none selected these questions
# fall through to semantic retrieval like anything else.
# ---------------------------------------------------------------------------
_PARTICIPANT_TRIGGER_WORDS = (
    "active participant", "which participants", "who are the participants",
    "who is enrolled", "which patients are enrolled", "participants in this study",
)
_REPORTS_TODAY_TRIGGER_WORDS = (
    "reports today", "how many reports", "today's reports", "reports were submitted",
    "reports have come in", "what are the reports",
)


def _detect_study_meta_query(question: str, study_id: str | None) -> str | None:
    if not study_id or study_id not in _STUDY_BY_ID:
        return None
    ql = question.lower()
    if any(t in ql for t in _REPORTS_TODAY_TRIGGER_WORDS):
        return "reports_today"
    if any(t in ql for t in _PARTICIPANT_TRIGGER_WORDS):
        return "participants"
    return None


def _study_participants_answer(study_id: str) -> dict:
    study = _STUDY_BY_ID[study_id]
    trial = _TRIAL_BY_ID.get(study["trial_id"])
    trial_label = f"{study['trial_id']} ({trial['title']})" if trial else study["trial_id"]
    active = [p for p in study["participants"] if p["status"] == "Active"]

    return {
        "answer": f"{len(active)} active participant(s) in {study_id}, all enrolled in {trial_label}:",
        "points": [
            f"{p['research_subject_id']} — Patient {p['patient_id']}, enrolled {p['enrolled_date']}"
            for p in active
        ],
        "basedOn": f"Based on {len(active)} participant enrollment record(s) in the current study roster "
                   f"(direct lookup — not LLM-estimated).",
        "sources": [
            {"id": p["patient_id"], "label": f"{p['research_subject_id']} / Patient {p['patient_id']}", "type": "record"}
            for p in active
        ],
    }


def _study_reports_today_answer(study_id: str) -> dict:
    study = _STUDY_BY_ID[study_id]
    all_reports = [(p, r) for p in study["participants"] for r in p["reports"]]
    if not all_reports:
        return {
            "answer": f"No daily reports are on file for {study_id}.",
            "points": [], "basedOn": "Based on 0 report records.", "sources": [],
        }

    latest_date = max(r["date"] for _, r in all_reports)
    todays = [(p, r) for p, r in all_reports if r["date"] == latest_date]

    points = []
    for p, r in todays:
        line = f"{p['research_subject_id']}: glucose {r['blood_glucose']} mg/dL, fatigue {r['fatigue']}"
        if r.get("adverse_event"):
            line += f", adverse event: {r['adverse_event']}"
        points.append(line)

    return {
        "answer": f"{len(todays)} report(s) were logged on {latest_date} (the most recent date on file) "
                  f"across {study_id}'s active participants:",
        "points": points,
        "basedOn": f"Based on {len(todays)} report record(s) dated {latest_date} (direct lookup — not LLM-estimated).",
        "sources": [
            {"id": f"{p['research_subject_id']}-{r['date']}", "label": f"{p['research_subject_id']} report — {r['date']}", "type": "report"}
            for p, r in todays
        ],
    }


# ---------------------------------------------------------------------------
# Semantic path — retrieval + (optional) LLM synthesis for qualitative questions.
# ---------------------------------------------------------------------------
def _keyword_search(question: str, docs: list[dict], k: int) -> list[dict]:
    """No blind fallback: if nothing actually shares a word with the
    question, return nothing rather than the first k docs in the corpus —
    padding results with irrelevant docs is what produced confident-looking
    but wrong 'sources' for questions about things that aren't in the
    dataset at all."""
    q_words = set(re.findall(r"[a-z0-9]+", question.lower()))
    scored = []
    for d in docs:
        d_words = re.findall(r"[a-z0-9]+", d["text"].lower())
        score = sum(1 for w in d_words if w in q_words)
        if score > 0:
            scored.append((score, d))
    scored.sort(key=lambda x: -x[0])
    return [d for _, d in scored[:k]]


def _faiss_search(question: str, subset: list[dict], idxs: list[int], k: int) -> list[dict]:
    """Real vector search: embed the subset with sentence-transformers, index
    it with FAISS (IndexFlatIP over normalized vectors = exact cosine
    similarity), and only return hits above _SEMANTIC_SIM_THRESHOLD. Building
    a fresh small index per call is cheap at this corpus size (dozens of
    docs) and keeps per-study filtering simple; a larger deployment would
    persist one index and filter by metadata instead of rebuilding."""
    import numpy as np
    import faiss

    q_emb = _EMBED_MODEL.encode([question], normalize_embeddings=True).astype("float32")
    sub_emb = _DOC_EMB[idxs]

    index = faiss.IndexFlatIP(sub_emb.shape[1])
    index.add(sub_emb)
    sims, order = index.search(q_emb, min(k, len(subset)))

    hits = []
    for sim, j in zip(sims[0], order[0]):
        if j == -1 or sim < _SEMANTIC_SIM_THRESHOLD:
            continue
        hits.append(subset[j])
    return hits


_ID_LIKE_TOKEN = re.compile(r"\b([A-Za-z]{1,4}-?\d{3,5})\b")


def _known_entity_ids() -> set[str]:
    ids = {p["id"].upper() for p in _RAW_PATIENTS}
    ids |= {t["id"].upper() for t in _RAW_TRIALS}
    ids |= {s["id"].upper() for s in _RAW_STUDIES}
    for s in _RAW_STUDIES:
        ids |= {p["research_subject_id"].upper() for p in s.get("participants", [])}
    return ids


def _mentions_unknown_entity(question: str) -> bool:
    """Cosine similarity alone can't reliably tell 'irrelevant' apart from
    'this specific named thing isn't in the dataset' — an all-clinical
    corpus means even a fabricated patient ID scores moderately similar to
    real patient records just from shared medical vocabulary (this is
    exactly how a made-up ID like an old Phase-2 mock 'RS-0001' could
    surface real-looking sources next to a 'not found' answer). So: if the
    question names something that LOOKS like a patient/trial/subject ID
    (e.g. 'P-9999', 'RS-0007', 'T999') and that exact ID isn't in the
    dataset, treat it as a hard signal to skip retrieval entirely rather
    than let embedding similarity paper over a nonexistent entity."""
    known = _known_entity_ids()
    for m in _ID_LIKE_TOKEN.finditer(question):
        token = m.group(1).upper()
        if token not in known:
            return True
    return False


def _retrieve(question: str, study_id: str | None, k: int = 6) -> list[dict]:
    ensure_index_built()

    if _mentions_unknown_entity(question):
        return []

    idxs = list(range(len(_DOC_META)))
    if study_id:
        study = _STUDY_BY_ID.get(study_id)
        if study:
            # Exact scope: the trial doc, every enrolled patient's record, and
            # every daily report belonging to this study's participants.
            subject_ids = {p["research_subject_id"] for p in study.get("participants", [])}
            patient_ids = {p["patient_id"] for p in study.get("participants", [])}
            filtered = [
                i for i, d in enumerate(_DOC_META)
                if d["id"] == study["trial_id"]
                or (d["type"] == "record" and d["id"] in patient_ids)
                or (d["type"] == "report" and d["id"].rsplit("-", 3)[0] in subject_ids)
            ]
            if filtered:
                idxs = filtered
        else:
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

    return _faiss_search(question, subset, idxs, k)


_SOURCE_LABEL_PREFIX = {"document": "Trial", "report": "Daily report —", "record": "Patient"}


def format_source_label(doc: dict) -> str:
    """Shared by both the sync (_synthesize) and streaming (main.py) paths
    so a doc's label can never drift between the two entry points."""
    return f"{_SOURCE_LABEL_PREFIX.get(doc['type'], 'Patient')} {doc['id']}"


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

    sources = [{"id": h["id"], "label": format_source_label(h), "type": h["type"]} for h in hits]
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
def try_structured_answer(question: str, study_id: str | None = None) -> dict | None:
    """Checks every deterministic short-circuit (lab stats, diagnosis cohort,
    trial-eligibility cohort) in priority order. Returns a complete answer
    dict if one matched, else None — meaning this genuinely needs semantic
    retrieval + LLM synthesis. Shared by both the sync and streaming entry
    points so they can never drift out of sync on which questions get
    answered deterministically vs. via RAG."""
    ensure_index_built()

    study_meta = _detect_study_meta_query(question, study_id)
    if study_meta == "participants":
        return _study_participants_answer(study_id)
    if study_meta == "reports_today":
        return _study_reports_today_answer(study_id)

    lab_code = _detect_structured_lab_query(question)
    if lab_code:
        return _structured_lab_answer(lab_code, study_id)

    trial_id = _detect_trial_cohort_query(question)
    if trial_id:
        return _trial_cohort_answer(trial_id)

    if _detect_global_eligibility_query(question):
        return _global_eligibility_answer()

    diag = _detect_diagnosis_cohort_query(question)
    if diag:
        return _diagnosis_cohort_answer(*diag)

    return None


def answer_research_question(question: str, study_id: str | None = None) -> dict:
    structured = try_structured_answer(question, study_id)
    if structured is not None:
        return structured

    hits = _retrieve(question, study_id)
    return _synthesize(question, hits)
