"""
Generates app/data/studies.json — synthetic Phase-2 longitudinal data
(active research participants + their daily reports) for the demo.

This is deliberately NOT hand-typed mock data: participants are drawn from
patients the deterministic matching engine (matching_engine.match_patient_to_trial)
actually finds ELIGIBLE for the study's trial, so "3 active participants in
DIAB-2026-001" is traceable back to a real /api/match result, not an
arbitrary UI constant. Daily reports are simulated with a seeded RNG so the
dataset is reproducible.

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

STUDY_ID = "DIAB-2026-001"
TRIAL_ID = "T101"
N_PARTICIPANTS = 3
N_DAYS = 14
END_DATE = date(2026, 8, 16)  # "today" for this demo dataset

ADVERSE_EVENTS = [
    "Mild headache, resolved same day.",
    "Nausea reported after morning dose.",
    "Dizziness on standing, monitored.",
    "Mild gastrointestinal discomfort.",
    "Fatigue greater than usual, no intervention needed.",
]

FATIGUE_LEVELS = ["None", "None", "None", "Mild", "Mild", "Moderate"]


def main():
    with open(DATA_DIR / "patients.json") as f:
        raw_patients = json.load(f)
    with open(DATA_DIR / "trials.json") as f:
        raw_trials = json.load(f)

    trial_raw = next(t for t in raw_trials if t["id"] == TRIAL_ID)
    trial = Trial(**trial_raw)

    eligible_ids = sorted(
        p["id"] for p in raw_patients
        if match_patient_to_trial(Patient(**p), trial).overall_status == "ELIGIBLE"
    )
    if len(eligible_ids) < N_PARTICIPANTS:
        raise RuntimeError(f"Only {len(eligible_ids)} patients are ELIGIBLE for {TRIAL_ID}; need {N_PARTICIPANTS}.")

    chosen = eligible_ids[:N_PARTICIPANTS]
    print(f"Enrolling {chosen} (ELIGIBLE for {TRIAL_ID}) into {STUDY_ID}")

    rng = random.Random(42)
    participants = []
    for i, pid in enumerate(chosen):
        research_subject_id = f"RS-{i + 1:04d}"
        enrolled_date = END_DATE - timedelta(days=190 + i * 2)

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
            "status": "Active",
            "enrolled_date": enrolled_date.isoformat(),
            "reports": reports,
        })

    study = {
        "id": STUDY_ID,
        "trial_id": TRIAL_ID,
        "title": trial_raw["title"],
        "participants": participants,
    }

    with open(DATA_DIR / "studies.json", "w") as f:
        json.dump([study], f, indent=2, ensure_ascii=False)
        f.write("\n")

    total_reports = sum(len(p["reports"]) for p in participants)
    print(f"Wrote studies.json: 1 study, {len(participants)} participants, {total_reports} total reports")


if __name__ == "__main__":
    main()
