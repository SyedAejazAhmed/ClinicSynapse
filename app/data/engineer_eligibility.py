"""
One-time data-engineering pass so every clinically-applicable trial has a
realistic pool of ELIGIBLE patients to demo, instead of zero.

Why this exists: after extraction-gap fixes in matching_engine.py (diagnosis/
medication/lab criteria that had no code, only free text) and reclassifying
free-text criteria that are actually machine-checkable (consent, EMR-
completeness, procedure/finding-based cohort definitions — see trials.json),
most trials became resolvable but still had zero patients whose *specific*
diagnosis/lab/medication values happened to fall inside a real oncology/
dental/pregnancy trial's bounds — none of the 200 synthetic patients were
originally generated with those narrow specialty trials in mind.

This script picks a random-sized (>10) subset of patients per trial and
patches in the exact real facts (diagnosis, lab, medication, procedure)
that trial's criteria require — additively (nothing is removed), the same
way a coordinator would document a newly-confirmed finding. It prefers
patients whose existing age/sex already satisfy the trial (zero-touch) before
overwriting anyone's demographics, and never reassigns a patient's age/sex
a second time once set for another trial, so no patient ends up in two
mutually-incompatible demographic states.

Three trials are left alone deliberately:
  - t-8:  pediatric radiotherapy trial; this dataset has only 7 patients
          under age 3, none plausible pediatric-oncology candidates.
  - t-d4: Allied Health Professional workforce study; its "patients" are
          clinicians/students, not medical patients — outside this schema.
  - t-d9: dental case-control study whose extracted criteria flatten three
          mutually exclusive cohorts (healthy / stage III-IV / grade C) into
          one AND'd list, including literally contradictory findings
          ("no clinical attachment loss" AND "attachment loss >= 5mm" both
          required) — not a data gap, a self-contradictory protocol
          extraction; can't be honestly satisfied by any patient.

Run from app/: python data/engineer_eligibility.py
"""

from __future__ import annotations

import json
import random
from pathlib import Path

DATA_DIR = Path(__file__).parent

EXCEPTION_TRIALS = {"t-8", "t-d4", "t-d9"}


def _dx(code, display, years_ago=1):
    return {"code": code, "display": display, "system": "ICD-10",
            "recorded_date": f"{2026 - years_ago}-03-01"}


def _lab(code, display, value, unit):
    return {"code": code, "display": display, "system": "LOCAL" if code.startswith("LOCAL") else "LOINC",
            "value": value, "unit": unit, "date": "2026-07-15"}


def _med(code, display, years_ago=1):
    return {"code": code, "display": display, "system": "RxNorm",
            "start_date": f"{2026 - years_ago}-01-15", "end_date": None, "status": "active"}


def _proc(code, display, years_ago=0):
    return {"code": code, "display": display, "system": "CPT", "date": f"{2026 - years_ago}-06-01"}


# age_range: (lo, hi) the chosen patient's age must land in. sex: required
# sex, or None if the trial doesn't constrain it.
PATCHES: dict[str, dict] = {
    "t-1": {
        "age_range": (18, 59), "sex": "Male",
        "diagnoses": [_dx("SYN-T1", "Type 2 diabetes mellitus with additional cardiovascular risk factors")],
        "labs": [
            _lab("4548-4", "Hemoglobin A1c", 8.5, "%"),
            _lab("33914-3", "Glomerular filtration rate/1.73 sq M.predicted", 75, "mL/min/1.73m2"),
            _lab("LOCAL-HEPUB", "Hepatic enzyme elevation", 1.0, "ULN"),
        ],
    },
    "t-2": {
        "age_range": (60, 90), "sex": None,
        "diagnoses": [_dx("SYN-T2", "Malignant neoplasm, unspecified site", years_ago=2)],
    },
    "t-3": {
        "age_range": (30, 80), "sex": None,
        "diagnoses": [_dx("SYN-T3", "ER or PR positive, HER2 negative locally advanced breast cancer")],
        "meds": [_med("SYN-T3-MED", "Ribociclib")],
    },
    "t-4": {
        "age_range": (30, 80), "sex": None,
        "diagnoses": [_dx("SYN-T4", "Invasive ductal carcinoma of the breast")],
    },
    "t-5": {
        "age_range": (18, 80), "sex": None,
        "procedures": [_proc("SYN-T5-PROC", "Bone marrow aspiration and biopsy")],
    },
    "t-6": {
        "age_range": (18, 80), "sex": None,
        "procedures": [_proc("SYN-T6-PROC", "Major oncosurgery - colectomy")],
    },
    "t-7": {
        "age_range": (20, 80), "sex": None,
        "diagnoses": [_dx("SYN-T7", "Malignant neoplasm, unspecified site", years_ago=1)],
    },
    "t-9": {
        "age_range": (18, 80), "sex": None,
        "diagnoses": [_dx("SYN-T9", "Gastric cancer")],
    },
    "t-d2": {
        "age_range": (30, 75), "sex": None,
        "diagnoses": [_dx("SYN-TD2", "Diabetes mellitus, on treatment", years_ago=7)],
    },
    "t-d3": {
        "age_range": (18, 80), "sex": None,
        "labs": [
            _lab("4548-4", "Hemoglobin A1c", 7.2, "%"),
            _lab("LOCAL-ASTALT", "AST/ALT", 1.5, "x ULN"),
            _lab("2160-0", "Creatinine [Mass/volume] in Serum or Plasma", 1.0, "mg/dl"),
            _lab("39156-5", "Body mass index (BMI)", 24.0, "Kg/m2"),
        ],
        "procedures": [_proc("SYN-TD3-PROC", "Owns smartphone, capable of using telehealth app for TPNP")],
    },
    "t-d5": {
        "age_range": (18, 45), "sex": "Female",
        "diagnoses": [_dx("SYN-TD5", "Diabetes in pregnancy (WHO criteria)", years_ago=0)],
        "meds": [_med("SYN-TD5-MED1", "Insulin"), _med("SYN-TD5-MED2", "Metformin")],
        "procedures": [_proc("SYN-TD5-PROC", "Singleton pregnancy confirmed via ultrasound")],
    },
    "t-d6": {
        "age_range": (18, 59), "sex": None,
        "diagnoses": [_dx("SYN-TD6", "Somatoform disorder")],
    },
    "t-d8": {
        "age_range": (18, 59), "sex": None,
        "procedures": [_proc("SYN-TD8-PROC", "Registered caregiver of inpatient, LGBRIMH Tezpur")],
    },
    "t-o1": {
        "age_range": (18, 75), "sex": None,
        "diagnoses": [_dx("SYN-TO1", "Triple-negative breast cancer (TNBC), locally advanced or metastatic")],
        "labs": [
            _lab("LOCAL-ECOG", "ECOG Performance Status", 0, "score"),
            _lab("LOCAL-PRIORLINES", "Prior lines of therapy for metastatic disease", 1, "lines"),
        ],
        "procedures": [
            _proc("SYN-TO1-PROC1", "RECIST 1.1 measurable disease confirmed on imaging"),
            _proc("SYN-TO1-PROC2", "Tumor tissue adequate for PIK3CA mutation testing"),
            _proc("SYN-TO1-PROC3", "Bone marrow and organ function adequate for study eligibility"),
        ],
    },
    "t-o2": {
        "age_range": (18, 64), "sex": None,
        "procedures": [_proc("SYN-TO2-PROC", "Hemorrhoidectomy")],
    },
    "t-o3": {
        "age_range": (18, 65), "sex": None,
        "diagnoses": [_dx("SYN-TO3", "Hepatocellular carcinoma (HCC), advanced")],
        "labs": [_lab("LOCAL-ECOG", "ECOG Performance Status", 1, "score")],
        "procedures": [_proc(
            "SYN-TO3-PROC",
            "Progressive disease after prior surgical/locoregional therapy; not eligible for surgical "
            "or locoregional therapy; Child-Pugh Class A; adequate hematologic, hepatic, and "
            "renal function confirmed at screening",
        )],
    },
}

TARGET_MIN, TARGET_MAX = 12, 45


def main():
    with open(DATA_DIR / "patients.json") as f:
        patients = json.load(f)
    with open(DATA_DIR / "trials.json") as f:
        trials = json.load(f)

    trial_ids = [t["id"] for t in trials if t["id"] not in EXCEPTION_TRIALS and t["id"] in PATCHES]

    rng = random.Random(20260817)
    by_id = {p["id"]: p for p in patients}
    all_ids = list(by_id.keys())

    # Once a patient's age/sex has been overwritten for one trial, never
    # touch it again for a different trial — avoids clobbering an earlier
    # trial's eligibility. Additive fields (diagnoses/labs/meds/procedures)
    # have no such restriction; a patient can legitimately accumulate
    # findings for several trials at once.
    demographics_touched: set[str] = set()

    for tid in trial_ids:
        patch = PATCHES[tid]
        target = rng.randint(TARGET_MIN, TARGET_MAX)
        lo, hi = patch["age_range"]
        need_sex = patch.get("sex")

        def already_fits(pid):
            p = by_id[pid]
            age = p["demographics"].get("age")
            sex = p["demographics"].get("sex")
            return (age is not None and lo <= age <= hi
                    and (need_sex is None or sex == need_sex))

        shuffled = all_ids[:]
        rng.shuffle(shuffled)

        # Pass 1: patients who already fit — zero-touch, no conflict risk.
        chosen = [pid for pid in shuffled if already_fits(pid)][:target]

        # Pass 2: top up from patients never demographically touched before.
        if len(chosen) < target:
            chosen_set = set(chosen)
            for pid in shuffled:
                if len(chosen) >= target:
                    break
                if pid in chosen_set or pid in demographics_touched:
                    continue
                p = by_id[pid]
                p["demographics"]["age"] = rng.randint(lo, hi)
                if need_sex is not None:
                    p["demographics"]["sex"] = need_sex
                chosen.append(pid)
                chosen_set.add(pid)

        # Every chosen patient's age/sex is now relied upon by this trial —
        # lock all of them (including pass-1 reuses, not just pass-2
        # overwrites) so a later trial can never retroactively change a
        # demographic another trial already depends on.
        demographics_touched.update(chosen)

        for pid in chosen:
            p = by_id[pid]
            # Replace-by-code rather than skip-if-exists, so re-running this
            # script (e.g. after tweaking a PATCH's wording) always converges
            # to the current spec instead of leaving a stale entry from an
            # earlier run in place.
            for dx in patch.get("diagnoses", []):
                p["diagnoses"] = [d for d in p["diagnoses"] if d["code"] != dx["code"]]
                p["diagnoses"].append(dx)
            for lab in patch.get("labs", []):
                p["labs"] = [l for l in p["labs"] if l["code"] != lab["code"]]
                p["labs"].append(lab)
            for med in patch.get("meds", []):
                p["medications"] = [m for m in p["medications"] if m["code"] != med["code"]]
                p["medications"].append(med)
            for proc in patch.get("procedures", []):
                p["procedures"] = [pr for pr in p["procedures"] if pr["code"] != proc["code"]]
                p["procedures"].append(proc)

        print(f"{tid}: {len(chosen)} patients (target {target})")

    with open(DATA_DIR / "patients.json", "w") as f:
        json.dump(list(by_id.values()), f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("Wrote patients.json")


if __name__ == "__main__":
    main()
