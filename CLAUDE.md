# Trial Screening Copilot — build context for Claude Code

## What this is
An MVP for the hackathon problem "Clinical Trial Matching & Research
Assistant," deliberately scoped down from five capabilities to one killer
workflow (see `README.md` for the full scoping rationale):

> Upload/select a clinical trial protocol + a patient record → determine
> which trials the patient may qualify for → explain every decision with
> evidence.

The differentiator is **explainable, evidence-backed screening** with three
states (Eligible / Needs Review / Ineligible) — not "an LLM decides."
The LLM is used ONLY to extract structured criteria from protocol text
(`app/extraction.py`); the actual eligibility decision is 100% deterministic
rules (`app/matching_engine.py`). Keep it that way — it's the pitch.

## Status: working skeleton, already runs end-to-end
Backend and frontend are wired together and tested with fallback data (no
API key required). What's NOT done yet is listed in the TODO checklist below
— that's the actual remaining work for the 3-hour build.

## Architecture
```
clinical-trial-mvp/
├── app/
│   ├── main.py              FastAPI app + routes + static file serving
│   ├── models.py             Pydantic schemas (READ THIS FIRST — defines the
│   │                         patient / trial-criteria / match-result shapes
│   │                         used everywhere else)
│   ├── matching_engine.py    Deterministic rule engine, 3-state output
│   ├── extraction.py         LLM extraction w/ safe fallback to static data
│   └── data/
│       ├── patients.json     3 synthetic patients
│       └── trials.json       4 synthetic trials (raw text + fallback criteria)
├── static/
│   ├── index.html            Single-page dashboard (no build step)
│   └── app.js                Fetches /api/*, renders patient list + ledger
├── requirements.txt
└── .env.example
```

Data flow: `trials.json` (raw protocol text) → `extraction.py` (LLM →
structured `TrialCriteria`, or fallback) → `matching_engine.py` (deterministic
comparison against a `Patient`) → `MatchResult` with a `CriterionResult` per
rule, each carrying a PASS/FAIL/REVIEW status + plain-English reason +
evidence source → rendered as an evidence ledger in the frontend.

## Run it
```bash
cd clinical-trial-mvp
pip install -r requirements.txt          # add --break-system-packages on Debian/Ubuntu
export ANTHROPIC_API_KEY=sk-...          # optional — omit to run entirely on fallback data
cd app && uvicorn main:app --reload --port 8000
```
Open http://localhost:8000 — API and frontend are served from the same
process, so there's nothing else to configure.

Swagger/OpenAPI docs (useful for testing without the UI): http://localhost:8000/docs

## Conventions to keep
- **Never let the LLM decide eligibility.** `extraction.py` only produces
  structured criteria; `matching_engine.py` only does deterministic
  comparisons. If you add a new criterion type, add an `eval_*` function in
  `matching_engine.py`, not a prompt.
- **Every FAIL/REVIEW needs a `reason` and `evidence` string.** That's what
  makes the demo land — don't let a new criterion type skip this.
- **The extraction fallback must never break.** Any new trial added to
  `trials.json` needs both `raw_protocol_text` (for the live LLM demo) and
  `fallback_criteria` (for offline/demo-safety reliability).
- Keep `models.py`'s docstring schema comments in sync if you change a shape
  — it's the single source of truth for the JSON contracts.

## 3-hour TODO checklist
Skeleton above covers roughly hour 1–2 of the original plan. Remaining work,
in priority order:

### Must have (do these first)
- [ ] Run a real extraction pass with `ANTHROPIC_API_KEY` set and confirm the
      live LLM output matches the `fallback_criteria` closely enough to trust
      on stage; fix `EXTRACTION_SYSTEM_PROMPT` in `extraction.py` if not.
- [ ] Add a loading state in `app.js` while `/api/screening-report/*` is
      in flight on first click (extraction can take a few seconds live).
- [ ] Walk through all 3 patients × 4 trials once in the UI and confirm every
      status (🟢/🟡/🔴) matches what you'd expect — this is your regression test.
- [ ] Add 1–2 more synthetic patients that hit edge cases you want to show
      live (e.g. a patient who is REVIEW on one trial and INELIGIBLE on another).

### Nice to have (only if time remains)
- [ ] Semantic diagnosis matching (see TODO comment in `matching_engine.py`)
      — e.g. "Type II Diabetes Mellitus" should match "Type 2 Diabetes".
- [ ] "Generate screening report" button that exports the current patient's
      full report as a downloadable PDF/markdown (good demo beat: "and here's
      the audit trail a coordinator can file").
- [ ] Simple PDF upload endpoint (`POST /api/trials`) using PyMuPDF to pull
      text out of an uploaded protocol, instead of only the 4 seeded trials.
- [ ] Missing-data metric: count how often REVIEW fires across the whole
      patient × trial matrix — this was flagged in the original plan as an
      important, easy-to-cite number for judges.

### Explicitly cut (do not build these in 3 hours)
Compliance tracking, source data verification, automated regulatory
documentation, full trial monitoring dashboard, real EMR integration, real
hospital data. These were in the original problem statement but do not fit a
3-hour scope — see `README.md` for the reasoning. If a judge asks, say so
explicitly: it's a stronger answer than pretending you built it.

## Demo script (for the last 15–20 minutes)
1. Open the dashboard, point at the disclaimer banner — say it out loud once.
2. Select **P-1024** → shows INELIGIBLE on ABC-2026 (eGFR 42 < 60) — click
   into it, walk the evidence ledger row by row.
3. Select the same patient's DEF-2026 result → ELIGIBLE — contrast: same
   patient, different trial, transparently different reasons.
4. Select **P-1031** → NEEDS_REVIEW on XYZ-2026 (missing LDL) — this is the
   most important state to show; it's what makes this a research *assistant*
   and not an autonomous decision system.
5. Close on the pitch line from the original scoping doc: "An evidence-backed
   clinical trial screening copilot that converts complex eligibility
   criteria into structured rules, matches them against patient records, and
   shows exactly why a patient qualifies, fails, or requires review."
