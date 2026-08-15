"""
Clinical Trial Matching & Research Assistant — backend.

Run:
    cd app && uvicorn main:app --reload --port 8000
Frontend runs separately (Frontend/, its own `npm run dev` on :5173);
CORS below allows any localhost port for that reason.

Endpoints:
    GET  /api/accounts                        -> mock login accounts (Admin / Doctor)
    GET  /api/patients                        -> list all patients
    GET  /api/patients/{patient_id}            -> one patient
    GET  /api/trials                           -> list trials (optional ?doctor_id= filter)
    GET  /api/trials/{trial_id}                -> one trial
    GET  /api/trials/{trial_id}/patients        -> every patient matched against this trial
                                                    (the "doctor portal" per-trial patient view)
    POST /api/match                            -> {patient_id, trial_id} -> MatchResult
    GET  /api/screening-report/{patient_id}     -> match against every trial, sorted best-first
    GET  /api/stats                            -> dashboard aggregate counts
    GET  /api/studies                          -> Phase-2 studies (participants + daily reports)
    GET  /api/studies/{study_id}                -> one study
    POST /api/research/query                   -> RAG chat, single JSON response
    POST /api/research/query/stream             -> RAG chat, Server-Sent Events (stream=true)
    POST /api/research/reindex                  -> rebuild the research assistant's in-memory index
"""

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from models import Account, MatchRequest, MatchResult, Patient, ResearchQuery, ResearchResponse, Study, Trial
from matching_engine import match_patient_to_trial
from research_assistant import answer_research_question, ensure_index_built, stream_research_answer

APP_DIR = Path(__file__).parent
DATA_DIR = APP_DIR / "data"
STATIC_DIR = APP_DIR.parent / "static"

app = FastAPI(title="Clinical Trial Matching & Research Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory "database" loaded from JSON at startup. Good enough for the
# current MVP; swap for a real database later without touching route logic.
# ---------------------------------------------------------------------------
_patients: dict[str, Patient] = {}
_trials: dict[str, Trial] = {}
_accounts: dict[str, Account] = {}
_studies: dict[str, Study] = {}


@app.on_event("startup")
def load_data():
    global _patients, _trials, _accounts, _studies

    with open(DATA_DIR / "patients.json") as f:
        _patients = {p["id"]: Patient(**p) for p in json.load(f)}

    with open(DATA_DIR / "trials.json") as f:
        _trials = {t["id"]: Trial(**t) for t in json.load(f)}

    with open(DATA_DIR / "accounts.json") as f:
        _accounts = {a["id"]: Account(**a) for a in json.load(f)}

    with open(DATA_DIR / "studies.json") as f:
        _studies = {s["id"]: Study(**s) for s in json.load(f)}

    print(f"[startup] loaded {len(_patients)} patients, {len(_trials)} trials, "
          f"{len(_accounts)} accounts, {len(_studies)} studies")

    try:
        ensure_index_built()
        print("[startup] research assistant index built")
    except Exception as e:
        print(f"[startup] WARNING: research index build failed, will retry lazily on first query: {e}")


# ---------------------------------------------------------------------------
# Accounts (mock login)
# ---------------------------------------------------------------------------
@app.get("/api/accounts", response_model=list[Account])
def list_accounts():
    return list(_accounts.values())


def _trials_for_account(account: Account | None) -> list[Trial]:
    if account is None or account.role == "ADMIN":
        return list(_trials.values())
    return [_trials[tid] for tid in account.assigned_trial_ids if tid in _trials]


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------
@app.get("/api/patients", response_model=list[Patient])
def list_patients():
    return list(_patients.values())


@app.get("/api/patients/{patient_id}", response_model=Patient)
def get_patient(patient_id: str):
    if patient_id not in _patients:
        raise HTTPException(404, f"Unknown patient_id '{patient_id}'")
    return _patients[patient_id]


# ---------------------------------------------------------------------------
# Trials
# ---------------------------------------------------------------------------
@app.get("/api/trials", response_model=list[Trial])
def list_trials(doctor_id: str | None = None):
    if doctor_id is None:
        return list(_trials.values())
    account = _accounts.get(doctor_id)
    if account is None:
        raise HTTPException(404, f"Unknown doctor_id '{doctor_id}'")
    return _trials_for_account(account)


@app.get("/api/trials/{trial_id}", response_model=Trial)
def get_trial(trial_id: str):
    if trial_id not in _trials:
        raise HTTPException(404, f"Unknown trial_id '{trial_id}'")
    return _trials[trial_id]


@app.get("/api/trials/{trial_id}/patients", response_model=list[MatchResult])
def trial_patients(trial_id: str):
    """Every patient matched against this trial — backs the doctor portal's
    'this trial's tested patient data' view."""
    if trial_id not in _trials:
        raise HTTPException(404, f"Unknown trial_id '{trial_id}'")
    trial = _trials[trial_id]
    results = [match_patient_to_trial(p, trial) for p in _patients.values()]
    results.sort(key=lambda r: _STATUS_RANK[r.overall_status])
    return results


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------
@app.post("/api/match", response_model=MatchResult)
def match(req: MatchRequest):
    if req.patient_id not in _patients:
        raise HTTPException(404, f"Unknown patient_id '{req.patient_id}'")
    if req.trial_id not in _trials:
        raise HTTPException(404, f"Unknown trial_id '{req.trial_id}'")
    return match_patient_to_trial(_patients[req.patient_id], _trials[req.trial_id])


_STATUS_RANK = {"ELIGIBLE": 0, "NEEDS_REVIEW": 1, "INELIGIBLE": 2}


@app.get("/api/screening-report/{patient_id}", response_model=list[MatchResult])
def screening_report(patient_id: str):
    if patient_id not in _patients:
        raise HTTPException(404, f"Unknown patient_id '{patient_id}'")
    patient = _patients[patient_id]
    results = [match_patient_to_trial(patient, trial) for trial in _trials.values()]
    results.sort(key=lambda r: _STATUS_RANK[r.overall_status])
    return results


@app.get("/api/stats")
def stats(doctor_id: str | None = None):
    """Dashboard aggregate: trial/patient counts + the full match-status
    breakdown across every patient x trial pair. Matching is pure deterministic
    Python (no LLM), so computing the whole matrix on request is cheap."""
    account = _accounts.get(doctor_id) if doctor_id else None
    trials = _trials_for_account(account)

    counts = {"ELIGIBLE": 0, "NEEDS_REVIEW": 0, "INELIGIBLE": 0}
    for trial in trials:
        for patient in _patients.values():
            counts[match_patient_to_trial(patient, trial).overall_status] += 1

    return {
        "trials": len(trials),
        "patients": len(_patients),
        "matches": sum(counts.values()),
        "eligibility": counts,
    }


# ---------------------------------------------------------------------------
# Studies (Phase 2 — enrolled participants + daily reports)
# ---------------------------------------------------------------------------
@app.get("/api/studies", response_model=list[Study])
def list_studies():
    return list(_studies.values())


@app.get("/api/studies/{study_id}", response_model=Study)
def get_study(study_id: str):
    if study_id not in _studies:
        raise HTTPException(404, f"Unknown study_id '{study_id}'")
    return _studies[study_id]


# ---------------------------------------------------------------------------
# Research Assistant (RAG chat)
# ---------------------------------------------------------------------------
@app.post("/api/research/query", response_model=ResearchResponse)
def research_query(req: ResearchQuery):
    return answer_research_question(req.question, req.study_id or None)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.post("/api/research/query/stream")
def research_query_stream(req: ResearchQuery):
    """Same answer as /api/research/query, but streamed as Server-Sent Events
    so the frontend can render tokens live instead of waiting for the full
    LLM response. Event sequence: one `sources` event (the tool/retrieval
    step is fast and doesn't depend on the LLM), then one or more `token`
    events as the narration streams in, then one `done` event with the
    closing bullet points. See research_assistant.stream_research_answer for
    the actual LLM-tool-planning -> deterministic-execution -> LLM-narration
    pipeline this wraps."""
    study_id = req.study_id or None

    def gen():
        for kind, *payload in stream_research_answer(req.question, study_id):
            if kind == "sources":
                sources, based_on = payload
                yield _sse("sources", {"sources": sources, "basedOn": based_on})
            elif kind == "token":
                yield _sse("token", {"text": payload[0]})
            elif kind == "done":
                yield _sse("done", {"points": payload[0]})

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.post("/api/research/reindex")
def research_reindex():
    ensure_index_built(force=True)
    return {"status": "ok"}


# Serve the legacy static/ bundle if present. The frontend now normally runs
# separately (Frontend/, its own `npm run dev`), so this is optional and
# skipped — rather than crashing on import — when static/ doesn't exist.
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
else:
    print(f"[startup] {STATIC_DIR} not found — skipping static mount; run the Frontend/ dev server separately")
