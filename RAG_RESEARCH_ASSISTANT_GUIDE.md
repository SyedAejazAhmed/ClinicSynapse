# Research Assistant (RAG) — what was built & how to run it

## What changed

**New:** `app/research_assistant.py` — a hybrid RAG engine over the real
dataset (`app/data/patients.json`, `trials.json`, 48 patients / 12 trials):

- **Structured path** — questions with an aggregate word ("average", "mean",
  "how many", "min/max", …) plus a recognizable lab name are answered by
  **direct computation** over the dataset (never the LLM): mean/min/max/N,
  optionally cohort-filtered to a trial's patients when a `studyId` is
  passed. This is the "don't retrieve embeddings for numeric questions"
  rule from the architecture spec.
- **Semantic path** — everything else does embedding retrieval (
  `sentence-transformers` `all-MiniLM-L6-v2` + cosine similarity, already in
  `requirements.txt`) over per-patient and per-trial text docs, then an
  Anthropic call narrates the retrieved evidence into `{answer, points[]}`.
- **Fallbacks, matching this repo's existing convention** (see
  `extraction.py`): no `ANTHROPIC_API_KEY` → extractive summary of the
  retrieved snippets instead of narration. `sentence-transformers`
  unavailable/offline → keyword-overlap retrieval instead of embeddings.
  Neither failure mode throws — verified locally (see Testing below).
- Every response carries `sources` (patient/trial IDs actually used), same
  evidence-first rule as `matching_engine.py`.

**New route:** `POST /api/research/query` in `app/main.py`, body
`{"question": str, "studyId": str}` → `{answer, points[], basedOn, sources[]}`
— the exact shape `Frontend/src/types/research.ts` already expects.
`POST /api/research/reindex` forces a rebuild if you edit the dataset.

**Fixed (pre-existing, was blocking everything):**
- `app/main.py` mounted `static/` at import time; that directory doesn't
  exist (the frontend is the separate `Frontend/` Vite app now), so
  `uvicorn main:app` crashed before it could even start. Now it mounts
  conditionally.
- `app/data/*.json` is a newer, nested (FHIR-like) schema that doesn't match
  the old flat `Patient`/`Trial` models in `models.py`, so the startup
  loader also crashed. It's now wrapped so a mismatch just disables the
  **old Phase-1** endpoints (`/api/patients`, `/api/match`,
  `/api/screening-report` — return empty/404) with a clear warning printed,
  instead of taking down the whole process. **This is out of scope for
  today's task** (reconciling those to the new schema is separate work) —
  `/api/research/query` does not depend on them; it reads the JSON directly.
- Added CORS (`localhost:*`) since the frontend now runs on its own port.

**Frontend:** `Frontend/src/services/researchApi.ts` now does a real
`fetch` to `${VITE_API_BASE_URL}/api/research/query` instead of returning
canned `setTimeout` data. `ResearchAssistant.tsx` and `ResearchChat.tsx`
needed no changes — same function signature. Every other `*Api.ts` file
(`patientApi`, `trialApi`, `matchingApi`, `studyApi`, `reportApi`) is
**still mocked** — untouched, out of scope.

## Run it

```bash
# Backend
cd "clinical-trial-mvp-or-repo-root/app"    # i.e. the app/ folder
pip install -r requirements.txt              # add --break-system-packages on Debian/Ubuntu
cp ../.env.example ../.env                   # optional: fill in ANTHROPIC_API_KEY
export ANTHROPIC_API_KEY=sk-ant-...          # optional — omit to run fully offline/extractive
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd Frontend
cp .env.example .env                         # VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev
```

Open the Vite dev URL it prints (typically http://localhost:5173) →
Research Assistant page. First semantic query will download the
`all-MiniLM-L6-v2` model (~90MB, one-time, needs internet); after that it's
cached locally by `sentence-transformers`.

## Verifying it without the UI

```bash
curl -s http://localhost:8000/api/research/query \
  -H 'Content-Type: application/json' \
  -d '{"question": "What is the average HbA1c?", "studyId": ""}' | python3 -m json.tool

curl -s http://localhost:8000/api/research/query \
  -H 'Content-Type: application/json' \
  -d '{"question": "What medications are patients taking?", "studyId": ""}' | python3 -m json.tool
```

The first should return computed mean/min/max/N (structured path, no LLM
involved even with a key set). The second exercises retrieval + LLM
synthesis (or the extractive fallback if no key is set).

Pass a real trial ID as `studyId` (e.g. `"T101"`, see `app/data/trials.json`)
to see cohort-filtered answers.

## What I verified already (so you don't have to re-check this)

Ran locally, not just read: `py_compile` on the three touched/added Python
files, a direct-import smoke test of `research_assistant.answer_research_question`
(structured + cohort-filtered + semantic-fallback paths, real data, 32/48
patients had HbA1c and cohort filtering matched correctly), and a FastAPI
`TestClient` boot + `POST /api/research/query` round trip returning `200`
with the expected shape. `sentence-transformers` isn't installed in this
dev environment, so semantic retrieval was verified via its keyword
fallback path only — install requirements and run one live query to
confirm the embedding path once you have the model downloaded.

## Known gap (not fixed, flagging so it's not a surprise)

`/api/patients`, `/api/match`, `/api/trials/*/extract`, `/api/screening-report`
(the original Phase-1 deterministic matcher) currently return empty/404
because `app/data/*.json` was regenerated in a shape the old `Patient`/
`Trial`/`matching_engine.py` code doesn't understand. That's a pre-existing
mismatch, not something introduced here, and reconciling it is a separate
task from the RAG work requested — the app boots and logs a clear warning
about it rather than crashing.
