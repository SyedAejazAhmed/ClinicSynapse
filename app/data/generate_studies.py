"""
Generates app/data/studies.json — synthetic Phase-2 longitudinal data
(active research participants + their daily reports) for the demo.

This is deliberately NOT hand-typed mock data: one study is generated per
trial in trials.json, and its participants are drawn from patients the
deterministic matching engine (matching_engine.match_patient_to_trial)
actually evaluates against that trial — so "N active participants in
STU-T1" is traceable back to real /api/match results, not an arbitrary UI
constant.

This dataset's trials were extracted from real CTRI protocol text, so most
carry at least one `free_text` criterion (e.g. "willing to provide informed
consent") that the matching engine intentionally can never resolve to PASS —
that's the point of the three-state model, see matching_engine.py's
docstring. That means an automated ELIGIBLE match essentially never happens
here. Study enrollment models what a real coordinator would do: prefer
ELIGIBLE patients when the engine finds any, otherwise enroll the NEEDS_REVIEW
patients closest to qualifying (fewest unresolved/review criteria) — i.e. a
human has cleared the free-text items by hand. Every enrolled patient_id is
still a real match result, never an arbitrary pick.

Daily reports are simulated with a seeded RNG so the dataset is reproducible.

Run from app/: python data/generate_studies.py
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from matching_engine import match_patient_to_trial
from models import Patient, Trial

DATA_DIR = Path(__file__).parent

MAX_PARTICIPANTS = 6
N_DAYS = 14
END_DATE = date(2026, 8, 16)  # "today" for this demo dataset

STATUS_WEIGHTS = [("Active", 70), ("Completed", 15), ("Review", 10), ("Withdrawn", 5)]

ADVERSE_EVENTS = [
    "Mild headache, resolved same day.",
    "Nausea reported after morning dose.",
    "Dizziness on standing, monitored.",
    "Mild gastrointestinal discomfort.",
    "Fatigue greater than usual, no intervention needed.",
]

FATIGUE_LEVELS = ["None", "None", "None", "Mild", "Mild", "Moderate"]


def _study_id_for(trial_id: str) -> str:
    return f"STU-{trial_id.upper().replace('-', '')}"


def _weighted_status(rng: random.Random) -> str:
    labels = [w[0] for w in STATUS_WEIGHTS]
    weights = [w[1] for w in STATUS_WEIGHTS]
    return rng.choices(labels, weights=weights, k=1)[0]


def _pick_participants(patients: list[Patient], trial: Trial) -> list[str]:
    """Rank every patient against this trial and return up to
    MAX_PARTICIPANTS candidate ids: ELIGIBLE patients first, then
    NEEDS_REVIEW patients ordered by fewest unresolved (REVIEW) criteria —
    i.e. closest to qualifying without a human sign-off. Never includes an
    INELIGIBLE patient."""
    scored = []
    for p in patients:
        result = match_patient_to_trial(p, trial)
        if result.overall_status == "INELIGIBLE":
            continue
        review_count = sum(1 for c in result.criteria_results if c.status == "REVIEW")
        rank = (0 if result.overall_status == "ELIGIBLE" else 1, review_count)
        scored.append((rank, p.id))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [pid for _, pid in scored[:MAX_PARTICIPANTS]]


def main():
    with open(DATA_DIR / "patients.json") as f:
        raw_patients = json.load(f)
    with open(DATA_DIR / "trials.json") as f:
        raw_trials = json.load(f)

    patients = [Patient(**p) for p in raw_patients]
    trials = [Trial(**t) for t in raw_trials]

    rs_counter = 0
    studies = []

    for trial_raw, trial in sorted(zip(raw_trials, trials), key=lambda pair: pair[1].id):
        chosen = _pick_participants(patients, trial)
        if not chosen:
            print(f"Skipping {trial.id} — no ELIGIBLE or NEEDS_REVIEW patients to enroll")
            continue

        study_id = _study_id_for(trial.id)
        rng = random.Random(f"{study_id}-42")
        print(f"Enrolling {chosen} into {study_id} ({trial.id})")

        participants = []
        for i, pid in enumerate(chosen):
            rs_counter += 1
            research_subject_id = f"RS-{rs_counter:04d}"
            enrolled_date = END_DATE - timedelta(days=190 + i * 2)
            status = _weighted_status(rng)

            glucose_baseline = rng.uniform(118, 145)
            hr_baseline = rng.uniform(70, 82)
            bp_sys_baseline = rng.uniform(118, 136)
            bp_dia_baseline = rng.uniform(76, 88)

            reports = []
            for d in range(N_DAYS - 1, -1, -1):
                report_date = END_DATE - timedelta(days=d)
                glucose = round(glucose_baseline + rng.uniform(-12, 14), 1)
                hr = round(hr_baseline + rng.uniform(-6, 6))
                bp_sys = round(bp_sys_baseline + rng.uniform(-8, 8))
                bp_dia = round(bp_dia_baseline + rng.uniform(-6, 6))
                fatigue = rng.choice(FATIGUE_LEVELS)
                adverse = rng.choice(ADVERSE_EVENTS) if rng.random() < 0.12 else None
                notes = (
                    f"Participant reported {fatigue.lower()} fatigue today."
                    if fatigue != "None" else "No new symptoms reported today."
                )
                reports.append({
                    "date": report_date.isoformat(),
                    "blood_glucose": glucose,
                    "heart_rate": hr,
                    "bp_systolic": bp_sys,
                    "bp_diastolic": bp_dia,
                    "fatigue": fatigue,
                    "adverse_event": adverse,
                    "notes": notes,
                })

            participants.append({
                "patient_id": pid,
                "research_subject_id": research_subject_id,
                "status": status,
                "enrolled_date": enrolled_date.isoformat(),
                "reports": reports,
            })

        studies.append({
            "id": study_id,
            "trial_id": trial.id,
            "title": trial_raw["title"],
            "participants": participants,
        })

    with open(DATA_DIR / "studies.json", "w") as f:
        json.dump(studies, f, indent=2, ensure_ascii=False)
        f.write("\n")

    total_participants = sum(len(s["participants"]) for s in studies)
    total_reports = sum(len(p["reports"]) for s in studies for p in s["participants"])
    print(f"Wrote studies.json: {len(studies)} studies, {total_participants} participants, {total_reports} total reports")


if __name__ == "__main__":
    main()
