"""
Deterministic eligibility matching engine.

Deliberate design choice: an LLM is never involved in eligibility decisions.
Trial protocols are pre-extracted into structured `eligibility.inclusion` /
`eligibility.exclusion` rules (see app/data/trials.json, produced offline by
extract_rules.py's OCR+LLM pipeline). This module only does plain if/else
comparisons against that structured data and the patient record, so every
result is reproducible and explainable — that's the project's actual
differentiator, not "an LLM decided."

Each criterion evaluates to one of three states:
  PASS   - requirement satisfied by patient data
  FAIL   - requirement violated (confirmed exclusion) or a required fact contradicted
  REVIEW - patient is missing the data needed to evaluate this criterion, OR
           the criterion is `free_text` and isn't machine-checkable at all —
           routing free_text straight to REVIEW is intentional, not a gap.

Overall status is then rolled up:
  any FAIL               -> INELIGIBLE
  no FAIL, any REVIEW     -> NEEDS_REVIEW
  no FAIL, no REVIEW       -> ELIGIBLE
"""

from datetime import date, datetime

from models import CriterionResult, MatchResult, Patient, Trial, TrialCriterion

PASS, FAIL, REVIEW = "PASS", "FAIL", "REVIEW"

_OPERATORS = {
    ">=": lambda a, b: a >= b,
    "<=": lambda a, b: a <= b,
    ">": lambda a, b: a > b,
    "<": lambda a, b: a < b,
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
}


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _months_since(iso_date: str | None, as_of: date) -> float | None:
    if not iso_date:
        return None
    try:
        d = datetime.fromisoformat(iso_date).date()
    except ValueError:
        return None
    return (as_of.year - d.year) * 12 + (as_of.month - d.month) - (1 if as_of.day < d.day else 0)


def _latest_lab(patient: Patient, code: str):
    matches = [lab for lab in patient.labs if lab.code == code]
    if not matches:
        return None
    return max(matches, key=lambda lab: lab.date or "")


def _result(crit: TrialCriterion, category: str, criterion: str, status: str,
            patient_value: str, requirement: str, evidence: str, reason: str | None = None) -> CriterionResult:
    return CriterionResult(
        criterion_id=crit.id, category=category, criterion=criterion, status=status,
        patient_value=patient_value, requirement=requirement, evidence=evidence, reason=reason,
    )


# ---------------------------------------------------------------------------
# One evaluator per `structured.type`
#
# Four of these types (age_range, diagnosis_required, lab_threshold,
# medication_required) are "requirement-style": `structured` describes a
# condition that, under an INCLUSION criterion, must hold true for the
# patient to qualify — but the same type can appear under an EXCLUSION
# criterion too (e.g. "eGFR < 45" as a disqualifying threshold), where the
# condition holding true means the opposite: the patient is excluded. So
# PASS/FAIL for these four is category-aware via `_verdict()` below.
#
# condition_forbidden and smoking_forbidden are "forbidden-style" by
# construction — their structured rule always describes what disqualifies a
# patient, independent of which bucket it's filed under — so they compute
# PASS/FAIL directly, with no category flip.
# ---------------------------------------------------------------------------
def _verdict(category: str, condition_met: bool) -> str:
    """condition_met = does the structured rule, taken at face value, hold
    for this patient? Under inclusion that's a requirement (met -> PASS);
    under exclusion it's a disqualifier (met -> FAIL)."""
    if category == "inclusion":
        return PASS if condition_met else FAIL
    return FAIL if condition_met else PASS


def eval_age_range(patient: Patient, crit: TrialCriterion, category: str, as_of: date) -> CriterionResult:
    s = crit.structured
    lo, hi = s.get("min"), s.get("max")
    requirement = " and ".join(filter(None, [f">= {lo}" if lo is not None else None, f"<= {hi}" if hi is not None else None])) or "any age"
    age = patient.demographics.age

    if age is None:
        return _result(crit, category, "Age", REVIEW, "not recorded", requirement,
                        "Patient demographics", "Patient age is missing from the record.")

    in_range = (lo is None or age >= lo) and (hi is None or age <= hi)
    status = _verdict(category, in_range)
    reason = None
    if status == FAIL:
        reason = (f"Patient age {age} is outside the required range ({requirement})." if category == "inclusion"
                   else f"Patient age {age} falls within the excluded range ({requirement}).")
    return _result(crit, category, "Age", status, str(age), requirement, "Patient demographics", reason)


def eval_diagnosis_required(patient: Patient, crit: TrialCriterion, category: str, as_of: date) -> CriterionResult:
    s = crit.structured
    codes = s.get("codes") or []
    min_months = s.get("min_duration_months")
    requirement = f"Diagnosis of {crit.text}" if not codes else f"Diagnosis code in {{{', '.join(codes)}}}"
    if min_months:
        requirement += f", recorded >= {min_months} months ago"

    if not patient.diagnoses:
        return _result(crit, category, "Diagnosis", REVIEW, "not recorded", requirement,
                        "Patient problem list", "No diagnoses are recorded for this patient.")

    matched = [d for d in patient.diagnoses if d.code in codes] if codes else []
    condition_met = bool(matched)
    if condition_met and min_months is not None:
        elapsed = _months_since(matched[0].recorded_date, as_of)
        if elapsed is not None and elapsed < min_months:
            condition_met = False

    status = _verdict(category, condition_met)
    have = ", ".join(f"{d.display} ({d.code})" for d in patient.diagnoses)
    patient_value = f"{matched[0].display} ({matched[0].code})" if matched else have
    reason = None
    if status == FAIL:
        reason = (f"None of the patient's diagnoses match the required code(s) ({', '.join(codes)})." if category == "inclusion"
                   else f"Patient's diagnosis ({patient_value}) matches an excluded diagnosis code.")
    return _result(crit, category, "Diagnosis", status, patient_value, requirement, "Patient problem list", reason)


def eval_lab_threshold(patient: Patient, crit: TrialCriterion, category: str, as_of: date) -> CriterionResult:
    s = crit.structured
    code, display = s.get("code"), s.get("display") or "Lab value"
    op, value, unit = s.get("operator"), s.get("value"), s.get("unit", "")
    requirement = f"{op} {value} {unit}".strip()

    lab = _latest_lab(patient, code)
    if lab is None:
        return _result(crit, category, display, REVIEW, "not recorded", requirement,
                        "Patient lab panel", f"No {display} value is on file for this patient.")

    fn = _OPERATORS.get(op)
    condition_met = fn(lab.value, value) if fn else False
    status = _verdict(category, condition_met)
    patient_value = f"{lab.value} {lab.unit}".strip()
    reason = None
    if status == FAIL:
        reason = (f"{display} of {patient_value} does not satisfy the required {requirement}." if category == "inclusion"
                   else f"{display} of {patient_value} meets the excluded threshold ({requirement}).")
    return _result(crit, category, display, status, patient_value, requirement, "Patient lab panel", reason)


def eval_medication_required(patient: Patient, crit: TrialCriterion, category: str, as_of: date) -> CriterionResult:
    s = crit.structured
    codes = s.get("codes") or []
    min_months = s.get("min_duration_months")
    requirement = f"On medication: {crit.text}" if not codes else f"Medication code in {{{', '.join(codes)}}}"
    if min_months:
        requirement += f", stable >= {min_months} months"

    if not patient.medications:
        return _result(crit, category, "Required medication", REVIEW, "not recorded", requirement,
                        "Patient medication list", "No medications are recorded for this patient.")

    matched = [m for m in patient.medications if m.code in codes and m.status == "active"]
    condition_met = bool(matched)
    if condition_met and min_months is not None:
        elapsed = _months_since(matched[0].start_date, as_of)
        if elapsed is not None and elapsed < min_months:
            condition_met = False

    status = _verdict(category, condition_met)
    have = ", ".join(m.display for m in patient.medications) or "none recorded"
    patient_value = matched[0].display if matched else have
    reason = None
    if status == FAIL:
        reason = (f"Patient is not currently on any of the required medications ({', '.join(codes)})." if category == "inclusion"
                   else f"Patient is currently on an excluded medication ({patient_value}).")
    return _result(crit, category, "Required medication", status, patient_value, requirement, "Patient medication list", reason)


def eval_condition_forbidden(patient: Patient, crit: TrialCriterion, category: str, as_of: date) -> CriterionResult:
    s = crit.structured
    keywords = [k.lower() for k in (s.get("keywords") or [])]
    requirement = f"None of: {', '.join(s.get('keywords') or [])}"

    haystack = " ".join(d.display for d in patient.diagnoses) + " " + " ".join(p.display for p in patient.procedures)
    haystack = haystack.lower()
    hit = [k for k in keywords if k in haystack]

    if hit:
        return _result(crit, category, "Forbidden condition", FAIL,
                        ", ".join(d.display for d in patient.diagnoses) or "—", requirement,
                        "Patient problem list / procedures",
                        f"Patient record matches excluded condition keyword(s): {', '.join(hit)}.")
    return _result(crit, category, "Forbidden condition", PASS, "No match found", requirement,
                    "Patient problem list / procedures")


def eval_smoking_forbidden(patient: Patient, crit: TrialCriterion, category: str, as_of: date) -> CriterionResult:
    s = crit.structured
    forbidden = [_norm(x) for x in (s.get("forbidden_statuses") or [])]
    requirement = f"Must not be: {', '.join(s.get('forbidden_statuses') or [])}"
    status = patient.social_history.smoking_status

    if not status:
        return _result(crit, category, "Smoking status", REVIEW, "not recorded", requirement,
                        "Patient social history", "Smoking status is not recorded for this patient.")
    ok = _norm(status) not in forbidden
    return _result(crit, category, "Smoking status", PASS if ok else FAIL, status, requirement,
                    "Patient social history",
                    None if ok else f"Patient's recorded smoking status ('{status}') is an exclusion criterion.")


def eval_free_text(patient: Patient, crit: TrialCriterion, category: str, as_of: date) -> CriterionResult:
    text_rule = crit.structured.get("text_rule", crit.text)
    return _result(crit, category, crit.text[:60], REVIEW, "not machine-checkable", text_rule,
                    "Trial protocol text",
                    f"This criterion (\"{text_rule}\") requires human judgement — it cannot be evaluated deterministically.")


CRITERION_EVALUATORS = {
    "age_range": eval_age_range,
    "diagnosis_required": eval_diagnosis_required,
    "lab_threshold": eval_lab_threshold,
    "medication_required": eval_medication_required,
    "condition_forbidden": eval_condition_forbidden,
    "smoking_forbidden": eval_smoking_forbidden,
    "free_text": eval_free_text,
}


def _eval_one(patient: Patient, crit: TrialCriterion, category: str, as_of: date) -> CriterionResult:
    rule_type = crit.structured.get("type")
    evaluator = CRITERION_EVALUATORS.get(rule_type)
    if evaluator is None:
        return _result(crit, category, crit.text[:60], REVIEW, "not machine-checkable",
                        crit.text, "Trial protocol text",
                        f"Unrecognized rule type '{rule_type}' — requires human review.")
    return evaluator(patient, crit, category, as_of)


def match_patient_to_trial(patient: Patient, trial: Trial, as_of: date | None = None) -> MatchResult:
    as_of = as_of or date.today()
    results: list[CriterionResult] = []

    for crit in trial.eligibility.inclusion:
        results.append(_eval_one(patient, crit, "inclusion", as_of))
    for crit in trial.eligibility.exclusion:
        results.append(_eval_one(patient, crit, "exclusion", as_of))

    statuses = [r.status for r in results]
    if FAIL in statuses:
        overall = "INELIGIBLE"
        failed = [r for r in results if r.status == FAIL]
        summary = f"Ineligible — {failed[0].reason}"
    elif REVIEW in statuses:
        overall = "NEEDS_REVIEW"
        missing = [r.criterion for r in results if r.status == REVIEW]
        summary = f"Needs review — missing/unverifiable data for: {', '.join(missing)}."
    else:
        overall = "ELIGIBLE"
        summary = f"Eligible — all {len(results)} evaluated criteria are satisfied."

    return MatchResult(
        patient_id=patient.id, trial_id=trial.id,
        overall_status=overall, criteria_results=results, summary=summary,
    )
