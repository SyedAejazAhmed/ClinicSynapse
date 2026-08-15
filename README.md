# Trial Screening Copilot (MVP)

An evidence-backed clinical trial screening assistant. Given a patient record
and a set of trial protocols, it extracts structured eligibility criteria,
runs a deterministic (non-LLM) matching engine, and shows exactly why a
patient is **Eligible**, **Needs Review**, or **Ineligible** for each trial —
with a criterion-by-criterion evidence trail.

Scoped down on purpose from a much larger 5-capability problem statement
(compliance tracking, source data verification, full monitoring dashboard,
EMR integration, etc.) to one workflow that's demoable in a few hours. See
`CLAUDE.md` for the full architecture, conventions, and remaining TODOs.

## Quickstart
```bash
pip install -r requirements.txt        # add --break-system-packages on Debian/Ubuntu
cp .env.example .env                   # optional: add ANTHROPIC_API_KEY to enable live extraction
export $(grep -v '^#' .env | xargs)    # or just `export ANTHROPIC_API_KEY=...`
cd app
uvicorn main:app --reload --port 8000
```
Open **http://localhost:8000**.

No API key? The app still runs completely — `extraction.py` falls back to
the pre-baked structured criteria in `app/data/trials.json`.

## Project layout
- `app/main.py` — FastAPI routes + serves the frontend
- `app/models.py` — the JSON schemas everything else follows
- `app/matching_engine.py` — deterministic eligibility rules (the actual "product")
- `app/extraction.py` — LLM protocol → structured criteria, with fallback
- `app/data/` — synthetic patients & trials (no real PHI)
- `static/` — plain HTML/JS dashboard, no build step

## API
Interactive docs at `/docs` once the server is running. Key endpoints:
- `GET /api/patients`, `GET /api/trials`
- `POST /api/match` `{patient_id, trial_id}` → full evidence-backed result
- `GET /api/screening-report/{patient_id}` → matched against every trial
