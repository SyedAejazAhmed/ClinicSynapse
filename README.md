<div align="center">

# 🧬 ClinicSynapse

### An evidence-backed Clinical Trial Matching & Research Assistant

*Turning fragmented patient records and dense eligibility protocols into transparent, defensible trial-matching decisions.*

[![Track](https://img.shields.io/badge/Track-4%20%E2%80%94%20Clinical%20Trial%20Matching-blue)](#-problem-statement)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688)](#tech-stack)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript-61DAFB)](#tech-stack)
[![LLM](https://img.shields.io/badge/Local%20LLM-Ollama%20gpt--oss%3A20b-black)](#-llm-configuration)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE.md)

[**System Architecture (gitdiagram)**](https://gitdiagram.com/SyedAejazAhmed/ClinicSynapse) · [**Deep Wiki**](https://deepwiki.com/SyedAejazAhmed/ClinicSynapse/1-clinicsynapse-overview) · [**Report a bug**](https://github.com/SyedAejazAhmed/ClinicSynapse/issues)

</div>

---

## 📋 Problem Statement

> **Clinical Trial Matching & Research Assistant**
>
> Finding eligible patients for clinical trials remains a significant challenge due to complex inclusion/exclusion criteria and fragmented patient records. Research teams spend considerable effort reviewing records and ensuring regulatory compliance.
>
> **Build an intelligent research assistant that automatically matches patients with clinical trial opportunities using EMRs, lab results, demographics, and eligibility criteria.** The system should automate patient screening, compliance monitoring, source data verification, and clinical trial documentation to accelerate recruitment and improve trial success rates.

**Expected capabilities:** Eligibility criteria extraction · Patient-trial matching · Compliance tracking · Research document intelligence · Clinical trial monitoring dashboard

**ClinicSynapse** is our answer to this brief — a full-stack (FastAPI + React) system that reads real trial protocol PDFs, extracts structured eligibility rules with a locally-hosted LLM, runs those rules deterministically against patient records, and lets a research coordinator interrogate the whole cohort in plain English — every answer traced back to its source.

---

## 🎯 Why ClinicSynapse

Most "AI matches patients to trials" demos hide the decision inside a black-box LLM call. That doesn't survive a regulatory audit, and it doesn't survive a skeptical PI. ClinicSynapse is built around one non-negotiable principle:

> **The LLM extracts. The LLM never decides.**

- **Extraction is LLM-assisted** — OCR + a local Ollama model (or a cloud fallback) reads a scanned trial protocol PDF and converts inclusion/exclusion prose into structured, typed rules (`age_range`, `lab_threshold`, `diagnosis_required`, `medication_required`, `condition_forbidden`, `smoking_forbidden`, …).
- **Matching is 100% deterministic** — `matching_engine.py` evaluates those structured rules against a patient record with plain Python comparisons. No prompt ever decides eligibility.
- **Every result carries evidence** — each criterion resolves to `PASS` / `FAIL` / `REVIEW`, with a human-readable reason and a citation back to the source field or document, so a coordinator can defend the decision to an auditor or an IRB.
- **Research questions get the same treatment** — a hybrid RAG layer answers cohort questions ("what's the average HbA1c across enrolled patients?") by *computing* over the dataset directly for numeric questions, and by retrieval + cited synthesis for everything else — never by letting the model guess a number.

---

## 🧩 Capability Coverage

Mapping the problem statement's five expected capabilities to what's implemented:

| Expected Capability | ClinicSynapse Implementation | Status |
|---|---|---|
| **Eligibility criteria extraction** | OCR (RapidOCR + pypdfium2) pulls text from scanned protocol PDFs → local LLM (Ollama `gpt-oss:20b`, cloud fallback) structures it into typed inclusion/exclusion rules (`app/extract_rules.py`) | ✅ Implemented |
| **Patient-trial matching** | Deterministic rule engine (`app/matching_engine.py`) evaluates structured criteria against patient demographics, diagnoses, labs, medications, and social history → 3-state result (Eligible / Needs Review / Ineligible) with per-criterion evidence | ✅ Implemented |
| **Research document intelligence** | Hybrid RAG assistant (`app/research_assistant.py`) — structured/computed answers for aggregate lab questions, semantic retrieval (sentence-transformers + FAISS) with cited LLM synthesis for open-ended questions, cohort-filterable by study | ✅ Implemented |
| **Clinical trial monitoring dashboard** | React dashboard — Studies, Trials, Patients, Trial↔Patient matching views, Reports & Reports Overview, Audit page | 🟡 UI scaffolded; several data services are currently mocked pending full EMR-shaped data wiring |
| **Compliance tracking / source data verification** | Every match and research answer returns a `sources[]` / evidence citation trail (patient field, trial document, or computed statistic) as the foundation for SDV and audit trails; a dedicated Audit page exists in the frontend | 🟡 Evidence-trail foundation built; full compliance/SDV workflow intentionally scoped as next milestone (see [Roadmap](#-roadmap)) |

We chose to scope tightly and get **evidence-backed extraction and matching** fully working end-to-end rather than build five shallow features.

---

## 🏗️ Architecture

For an auto-generated, always-up-to-date visual of the codebase, see the interactive diagram:

**→ [gitdiagram.com/SyedAejazAhmed/ClinicSynapse](https://gitdiagram.com/SyedAejazAhmed/ClinicSynapse)**

And for a navigable, AI-generated explanation of every module and how it fits together:

**→ [deepwiki.com/SyedAejazAhmed/ClinicSynapse](https://deepwiki.com/SyedAejazAhmed/ClinicSynapse/1-clinicsynapse-overview)**

### High-level data flow

```
                    ┌───────────────────────────┐
                    │  Trial Protocol (PDF)     │
                    └────────────┬──────────────┘
                                 │  OCR (RapidOCR + pypdfium2)
                                 ▼
                    ┌───────────────────────────┐
                    │  Local LLM Extraction     │   Ollama gpt-oss:20b (local)
                    │  (extract_rules.py)       │   → Groq → LM Studio → fallback
                    └────────────┬──────────────┘
                                 │  structured TrialCriteria (JSON)
                                 ▼
┌───────────────────┐   ┌──────────────────────────┐   ┌────────────────────┐
│  Patient Record   │──>│  Deterministic Matching  │──>│  Evidence-backed   │
│ (EMR-shaped JSON) │   │ Engine (matching_engine) │   │    MatchResult     │
└───────────────────┘   └──────────────────────────┘   └────────────────────┘
                                                                   │
                    ┌───────────────────────────┐                  │
                    │  Hybrid RAG Research      │<─────────────────┘
                    │  Assistant (FAISS +       │   cohort Q&A, cited
                    │  sentence-transformers)   │   sources, computed stats
                    └────────────┬──────────────┘
                                 │  REST API (FastAPI)
                                 ▼
                    ┌──────────────────────────┐
                    │  React Dashboard          │   Studies · Trials · Patients
                    │  (Vite + TypeScript)      │   Matching · Reports · Audit
                    └──────────────────────────┘
```

### Database / data schema

The dataset layer models patients and trials in an FHIR-inspired shape (demographics, diagnoses, labs, medications, procedures, allergies, consent, and data-completeness metadata — see `app/models.py`).

<!--
  Local asset — add this repo's `db scheme.jpeg` to a docs/assets folder
  (e.g. docs/assets/db-scheme.jpeg) and this will render on GitHub.
-->
![Database schema](/DB%20scheme.jpeg)

### Backend architecture

FastAPI service layer, extraction pipeline, deterministic matching engine, and the hybrid RAG research assistant, wired together in `app/main.py`.

<!--
  Local asset — add this repo's `backend.jpeg` to a docs/assets folder
  (e.g. docs/assets/backend.jpeg) and this will render on GitHub.
-->
![Backend architecture](/Backend.jpeg)

> **Note:** the two diagrams above (`db scheme.jpeg`, `backend.jpeg`) live locally alongside this project. Drop them into `docs/assets/` in the repo (matching the filenames referenced above) and GitHub will render them inline — nothing else needs to change.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend API** | FastAPI, Pydantic v2, Uvicorn |
| **OCR** | RapidOCR (ONNX Runtime) + pypdfium2, Pillow |
| **Local LLM (extraction + RAG synthesis)** | **Ollama running `gpt-oss:20b` locally**, via an OpenAI-compatible client |
| **LLM fallbacks** | Groq (`llama-3.3-70b-versatile`), LM Studio |
| **Retrieval** | `sentence-transformers` (`all-MiniLM-L6-v2`) + FAISS, with a keyword-overlap fallback when offline |
| **Frontend** | React 19, TypeScript, Vite, React Router, lucide-react |
| **Linting** | oxlint |

### 🤖 LLM configuration

ClinicSynapse is designed to run **entirely locally** with no API keys, defaulting to **Ollama** for both criteria extraction and research-assistant synthesis:

```bash
# 1. Install Ollama: https://ollama.com
# 2. Pull the default model used throughout this project
ollama pull gpt-oss:20b

# 3. Start the Ollama server (or let it auto-start)
ollama serve
```

The provider-resolution order (see `app/utils/llm_provider.py` and `.env.example`) is:

1. **Ollama** (`gpt-oss:20b` by default) — used automatically if reachable at `OLLAMA_BASE_URL` with the model pulled. This is what the primary author runs locally — no key needed.
2. **Groq API** — if `GROQ_API_KEY` is set and Ollama isn't reachable. This is the path for anyone cloning the repo without a local Ollama install: set one env var and everything (criteria extraction, OCR cleaning, research-assistant synthesis) works the same way, no local model required.
3. **LM Studio** — legacy local fallback via `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`.
4. **Extractive fallback** — if no LLM backend is reachable at all, the app degrades gracefully to deterministic/extractive answers instead of erroring. It never crashes for lack of a key.

`.env` at the repo root is loaded automatically on backend startup (via `python-dotenv`), so `cp .env.example .env` and filling in `GROQ_API_KEY` is all a fresh clone needs. You can also force a specific backend with `LLM_PROVIDER=ollama|groq|lm_studio`.

---

## 📁 Project Structure

```
ClinicSynapse/
├── app/
│   ├── main.py               FastAPI app, routes, startup wiring
│   ├── models.py              Pydantic schemas — the source of truth for every
│   │                          JSON shape (Patient, Trial, MatchResult, Study, …)
│   ├── matching_engine.py     Deterministic eligibility rule engine
│   ├── extraction.py          LLM protocol → structured criteria (with fallback)
│   ├── extract_rules.py       OCR + LLM pipeline for scanned trial protocol PDFs
│   ├── research_assistant.py  Hybrid RAG: structured stats + semantic retrieval
│   ├── rag_pdf.py             PDF ingestion helpers for the RAG pipeline
│   ├── utils/
│   │   ├── llm_provider.py    Ollama → Groq → LM Studio backend resolution
│   │   ├── pdf_to_text.py     OCR text extraction
│   │   └── cleaner.py         Text/JSON cleanup helpers
│   └── data/                  Synthetic patients & trials (no real PHI)
├── dataset/                   Sample real-world trial protocol PDFs (criteria extraction inputs)
├── Frontend/
│   ├── src/
│   │   ├── pages/             Dashboard, Studies, Trials, Patients, Matching,
│   │   │                      TrialDetails, PatientDetails, ResearchAssistant,
│   │   │                      Reports, ReportsOverview, Audit, Login
│   │   ├── components/        EligibilityCard, EvidencePanel, CriteriaTable,
│   │   │                      MatchScore, StatusBadge, SourceCitation,
│   │   │                      ResearchChat, TrialCard, PatientCard, ReportTimeline
│   │   ├── services/          API clients (patientApi, trialApi, matchingApi,
│   │   │                      studyApi, reportApi, researchApi, accountApi)
│   │   ├── context/            AuthContext
│   │   └── types/              Shared TypeScript contracts
│   └── package.json
├── requirements.txt
├── .env.example
├── CLAUDE.md                  Full architecture notes, conventions, build TODOs
└── RAG_RESEARCH_ASSISTANT_GUIDE.md   Deep-dive on the research assistant
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- [Ollama](https://ollama.com) (recommended, for a fully local/offline run) with `gpt-oss:20b` pulled — or a `GROQ_API_KEY` ([free tier](https://console.groq.com/keys)) as an alternative if you don't want to run a local model

### 1. Backend

```bash
git clone https://github.com/SyedAejazAhmed/ClinicSynapse.git
cd ClinicSynapse

pip install -r requirements.txt        # add --break-system-packages on Debian/Ubuntu

cp .env.example .env                   # configure Ollama / Groq as you prefer
# Default .env already points at a local Ollama instance — no key required.
# No Ollama? Just set GROQ_API_KEY in .env instead — everything else works the same.

cd app
uvicorn main:app --reload --port 8000
```

API docs available at **http://localhost:8000/docs**.

### 2. Frontend

```bash
cd Frontend
cp .env.example .env                   # VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev
```

Open the printed Vite URL (typically **http://localhost:5173**).

> No LLM configured? The app still runs end-to-end — extraction and research-assistant answers gracefully fall back to pre-baked structured criteria / extractive summaries instead of erroring.

### 3. Verify the research assistant without the UI

```bash
curl -s http://localhost:8000/api/research/query \
  -H 'Content-Type: application/json' \
  -d '{"question": "What is the average HbA1c?", "studyId": ""}' | python3 -m json.tool
```

This should return a **computed** mean/min/max/N — the structured path bypasses the LLM entirely for aggregate numeric questions.

---

## 🔌 API Reference

Interactive Swagger docs at `/docs`. Key endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/studies`, `/api/studies/{study_id}` | List / fetch clinical studies |
| `GET` | `/api/trials`, `/api/trials/{trial_id}` | List / fetch trial protocols and structured criteria |
| `GET` | `/api/trials/{trial_id}/patients` | Matched patients for a given trial |
| `GET` | `/api/patients`, `/api/patients/{patient_id}` | List / fetch patient records |
| `POST` | `/api/match` | `{patient_id, trial_id}` → full evidence-backed `MatchResult` |
| `GET` | `/api/screening-report/{patient_id}` | Patient matched against every trial |
| `POST` | `/api/research/query` | `{question, studyId}` → `{answer, points[], basedOn, sources[]}` |
| `POST` | `/api/research/query/stream` | Streaming variant of the research query |
| `POST` | `/api/research/reindex` | Rebuilds the RAG index after dataset changes |
| `GET` | `/api/accounts` | Account/coordinator records |
| `GET` | `/api/stats` | Aggregate dashboard statistics |

---

## 🧪 Data Model

Core schemas (see `app/models.py` for the full definitions):

- **`Patient`** — demographics, diagnoses, labs, medications, procedures, allergies, consent, and a `DataCompleteness` block (so the matcher knows *why* a criterion is `REVIEW` rather than `PASS`/`FAIL`).
- **`Trial`** — structured `Eligibility` (inclusion/exclusion `TrialCriterion[]`), phase, condition, intervention, and `TrialSource` (protocol document provenance).
- **`MatchResult`** — overall status (`Eligible` / `Needs Review` / `Ineligible`) plus a `CriterionResult[]` evidence ledger, one row per rule, each with a reason and a source citation.
- **`ResearchQuery` / `ResearchResponse`** — question + optional study filter → answer, bullet points, and `SourceCitation[]`.

All demo data (`app/data/`) is **synthetic — no real PHI** — plus a handful of real, de-identified sample trial protocol PDFs in `dataset/` used to exercise the OCR/extraction pipeline.

---

## 🗺️ Roadmap

Deliberately out of scope for the current build (see `CLAUDE.md` for the full reasoning) and next on the list:

- [ ] Full compliance-tracking workflow (protocol deviation logging, IRB status tracking)
- [ ] Formal source data verification (SDV) sign-off flow on top of the existing evidence trail
- [ ] Wire the remaining frontend services (`patientApi`, `trialApi`, `studyApi`, `reportApi`) to live backend data — several are currently mocked
- [ ] Auto-generated regulatory/enrollment documentation exports (PDF/Markdown) from the evidence ledger
- [ ] Semantic (not just exact-string) diagnosis matching, e.g. "Type II Diabetes Mellitus" ↔ "Type 2 Diabetes"
- [ ] Reconcile the newer FHIR-like dataset schema with the original flat `Patient`/`Trial` models so all Phase-1 endpoints run off one consistent shape

---

## ⚠️ Disclaimer

This is a hackathon MVP built on **synthetic patient data**. It is **not** a validated clinical decision-support tool, is **not** intended for use with real patients or PHI, and has not undergone regulatory review. Every eligibility decision it produces is meant to be reviewed by a qualified research coordinator, not acted on autonomously.

---

## 🤝 Contributing

Issues and PRs are welcome — please open an issue at [github.com/SyedAejazAhmed/ClinicSynapse/issues](https://github.com/SyedAejazAhmed/ClinicSynapse/issues) before submitting larger changes.

## 📄 License

This project is licensed under the **MIT License** — see [`LICENSE.md`](./LICENSE.md) for the full text.

## 📚 Further Reading

- [`LICENSE.md`](./LICENSE.md) — MIT License terms
- [Auto-generated architecture diagram (gitdiagram)](https://gitdiagram.com/SyedAejazAhmed/ClinicSynapse)
- [Deep Wiki overview](https://deepwiki.com/SyedAejazAhmed/ClinicSynapse/1-clinicsynapse-overview)

<div align="center">

Built for **Track 4 — Clinical Trial Matching & Research Assistant**

</div>