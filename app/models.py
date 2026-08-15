"""
Pydantic models shared across the app.

These mirror the ACTUAL shape of app/data/patients.json and app/data/trials.json
(the OCR/extraction-pipeline output format — see extract_rules.py's
RULES_JSON_TEMPLATE for the trial side). Trials already carry fully structured
eligibility rules baked in; there is no separate "extraction" step at request
time anymore, so Trial.eligibility is always populated.

PATIENT (see app/data/patients.json)
{
  "id": str,
  "demographics": {"age": int, "sex": str, "race": str, "ethnicity": str},
  "diagnoses": [{"code", "display", "system", "recorded_date"}, ...],
  "labs": [{"code", "display", "system", "value", "unit", "date"}, ...],
  "medications": [{"code", "display", "system", "start_date", "end_date", "status"}, ...],
  "procedures": [{"code", "display", "system", "date"}, ...],
  "allergies": [{"substance", "reaction", "status"}, ...],
  "social_history": {"smoking_status": str, "alcohol_use": str},
  "consent": {"trial_interest": bool, "data_use_consent": bool, "last_updated": str},
  "data_completeness": {"score": float, "missing_sections": [str, ...]}
}

TRIAL (see app/data/trials.json)
{
  "id": str, "title": str, "phase": str,
  "condition": [str, ...], "intervention": [str, ...],
  "eligibility": {
    "inclusion": [{"id", "category", "text", "structured": {"type": ..., ...}}, ...],
    "exclusion": [same shape]
  },
  "consent_required": bool,
  "source": {"clinicaltrials_gov_id": str|null, "protocol_pdf_url": str|null},
  "status": str,            # enrichment: recruitment status, not part of extraction schema
  "sponsor": str,           # enrichment
  "locations": [str, ...],  # enrichment
  "start_date": str         # enrichment
}

`structured.type` (see matching_engine.CRITERION_EVALUATORS) is one of:
  age_range, diagnosis_required, lab_threshold, medication_required,
  condition_forbidden, smoking_forbidden, free_text (always routes to REVIEW —
  it's not machine-checkable, that's the point of the three-state model).

Every criterion is evaluated independently, so a new `structured.type` can be
added to matching_engine.CRITERION_EVALUATORS without touching the rest of
the app.
"""

from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Patient
# ---------------------------------------------------------------------------
class Demographics(BaseModel):
    age: Optional[int] = None
    sex: Optional[str] = None
    race: Optional[str] = None
    ethnicity: Optional[str] = None


class Diagnosis(BaseModel):
    code: str
    display: str
    system: str
    recorded_date: Optional[str] = None


class Lab(BaseModel):
    code: str
    display: str
    system: str
    value: float
    unit: str
    date: Optional[str] = None


class Medication(BaseModel):
    code: str
    display: str
    system: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None


class Procedure(BaseModel):
    code: str
    display: str
    system: Optional[str] = None
    date: Optional[str] = None


class Allergy(BaseModel):
    substance: str
    reaction: Optional[str] = None
    status: Optional[str] = None


class SocialHistory(BaseModel):
    smoking_status: Optional[str] = None
    alcohol_use: Optional[str] = None


class Consent(BaseModel):
    trial_interest: Optional[bool] = None
    data_use_consent: Optional[bool] = None
    last_updated: Optional[str] = None


class DataCompleteness(BaseModel):
    score: Optional[float] = None
    missing_sections: list[str] = Field(default_factory=list)


class Patient(BaseModel):
    id: str
    demographics: Demographics = Field(default_factory=Demographics)
    diagnoses: list[Diagnosis] = Field(default_factory=list)
    labs: list[Lab] = Field(default_factory=list)
    medications: list[Medication] = Field(default_factory=list)
    procedures: list[Procedure] = Field(default_factory=list)
    allergies: list[Allergy] = Field(default_factory=list)
    social_history: SocialHistory = Field(default_factory=SocialHistory)
    consent: Consent = Field(default_factory=Consent)
    data_completeness: DataCompleteness = Field(default_factory=DataCompleteness)


# ---------------------------------------------------------------------------
# Trial
# ---------------------------------------------------------------------------
class TrialCriterion(BaseModel):
    id: str
    category: str
    text: str
    structured: dict[str, Any] = Field(default_factory=dict)


class Eligibility(BaseModel):
    inclusion: list[TrialCriterion] = Field(default_factory=list)
    exclusion: list[TrialCriterion] = Field(default_factory=list)


class TrialSource(BaseModel):
    clinicaltrials_gov_id: Optional[str] = None
    protocol_pdf_url: Optional[str] = None


class Trial(BaseModel):
    id: str
    title: str
    phase: Optional[str] = None
    condition: list[str] = Field(default_factory=list)
    intervention: list[str] = Field(default_factory=list)
    eligibility: Eligibility = Field(default_factory=Eligibility)
    consent_required: bool = False
    source: Optional[TrialSource] = None

    # Demo/portal-display enrichment — not part of the extraction schema.
    status: str = "RECRUITING"
    sponsor: str = "Unspecified sponsor"
    locations: list[str] = Field(default_factory=list)
    start_date: Optional[str] = None


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------
class CriterionResult(BaseModel):
    criterion_id: str          # e.g. "INC-3" — ties back to TrialCriterion.id
    category: Literal["inclusion", "exclusion"]
    criterion: str              # human-readable label, e.g. "HbA1c"
    status: str                # "PASS" | "FAIL" | "REVIEW"
    patient_value: str         # what the patient record shows (or "not recorded")
    requirement: str           # what the trial requires
    evidence: str               # where this came from, e.g. "Patient lab panel"
    reason: Optional[str] = None  # only set for FAIL / REVIEW


class MatchResult(BaseModel):
    patient_id: str
    trial_id: str
    overall_status: str        # "ELIGIBLE" | "NEEDS_REVIEW" | "INELIGIBLE"
    criteria_results: list[CriterionResult]
    summary: str                # one-line human-readable explanation


class MatchRequest(BaseModel):
    patient_id: str
    trial_id: str


# ---------------------------------------------------------------------------
# Accounts (mock auth — Admin sees every trial, a Doctor sees only the
# trials assigned to them). No passwords: this is a demo-only identity
# picker, not a real auth system — see README for what a real ABDM-style
# deployment would need instead.
# ---------------------------------------------------------------------------
class Account(BaseModel):
    id: str
    name: str
    role: Literal["ADMIN", "DOCTOR"]
    initials: str
    assigned_trial_ids: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Phase 2 — Studies & daily reports (see app/data/studies.json).
#
# A Study is a real trial (trial_id) actually being run, with a handful of
# real patients (patient_id) enrolled as research subjects. Participants are
# drawn from patients the deterministic matching engine actually finds
# ELIGIBLE for that trial — this is synthetic data, generated once (see
# scripts/generate_studies.py-equivalent used to build the JSON), not live,
# but every number the frontend displays (participant count, reports today,
# adverse event count) is computed from these records, not hand-typed mock
# constants. Ask the Research Assistant about it and the answer is grounded
# in these exact records.
# ---------------------------------------------------------------------------
class DailyReport(BaseModel):
    date: str
    blood_glucose: float
    heart_rate: int
    bp_systolic: int
    bp_diastolic: int
    fatigue: str  # "None" | "Mild" | "Moderate" | "Severe"
    adverse_event: Optional[str] = None
    notes: Optional[str] = None


class StudyParticipant(BaseModel):
    patient_id: str
    research_subject_id: str
    status: str  # "Active" | "Completed" | "Review" | "Withdrawn"
    enrolled_date: str
    reports: list[DailyReport] = Field(default_factory=list)


class Study(BaseModel):
    id: str
    trial_id: str
    title: str
    participants: list[StudyParticipant] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Phase 2 — Research Assistant (RAG). Shapes mirror Frontend/src/types/research.ts
# exactly; do not rename fields without updating that file too.
# ---------------------------------------------------------------------------
class SourceCitation(BaseModel):
    id: str
    label: str
    type: str  # "report" | "record" | "document"


class ResearchQuery(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    question: str
    study_id: str = Field(default="", alias="studyId")


class ResearchResponse(BaseModel):
    answer: str
    points: list[str] = Field(default_factory=list)
    basedOn: str
    sources: list[SourceCitation] = Field(default_factory=list)
    followUps: list[str] = Field(default_factory=list)
