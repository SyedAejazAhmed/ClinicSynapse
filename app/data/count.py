import json
from pathlib import Path


def count_json_records(file_path):
    """Count top-level records in a JSON array."""
    path = Path(file_path)

    if not path.exists():
        print(f"File not found: {path}")
        return 0

    try:
        with open(path, "r", encoding="utf-8") as file:
            data = json.load(file)

        if isinstance(data, list):
            return len(data)

        # Handle JSON objects containing a list under a common key
        if isinstance(data, dict):
            for key in ["patients", "trials", "data", "records"]:
                if key in data and isinstance(data[key], list):
                    return len(data[key])

        print(f"Unsupported JSON structure in: {path}")
        return 0

    except json.JSONDecodeError as e:
        print(f"Invalid JSON in {path}: {e}")
        return 0


def main():
    import pathlib
    folder_path = pathlib.Path(__file__).parent
    patients_file = folder_path / "patients.json"
    trials_file = folder_path / "trials.json"

    patient_count = count_json_records(patients_file)
    trial_count = count_json_records(trials_file)

    print("=" * 45)
    print("Clinical Trial Dataset Statistics")
    print("=" * 45)

    print(f"Patient records : {patient_count}")
    print(f"Trial records   : {trial_count}")

    print("-" * 45)
    print(f"Total records   : {patient_count + trial_count}")
    print("=" * 45)


if __name__ == "__main__":
    main()