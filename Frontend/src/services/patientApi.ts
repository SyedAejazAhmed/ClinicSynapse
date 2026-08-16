import type { Patient, Lab } from '../types/patient';
import { API_BASE } from './apiBase';

// A few LOINC codes get a short clinical shorthand for display; anything
// else falls back to its full display name from the record.
const LAB_SHORT_NAMES: Record<string, string> = {
  '4548-4': 'HbA1c',
  '33914-3': 'eGFR',
  '2160-0': 'Creatinine',
  '13457-7': 'LDL',
  '89247-1': 'ECOG',
};

function toPatient(p: any): Patient {
  return {
    id: p.id,
    researchId: p.id,
    age: p.demographics?.age ?? 0,
    sex: (p.demographics?.sex ?? 'Other') as Patient['sex'],
    diagnoses: (p.diagnoses ?? []).map((d: any) => d.display),
    labs: (p.labs ?? []).map((l: any): Lab => ({
      name: LAB_SHORT_NAMES[l.code] ?? l.display,
      value: l.value,
      unit: l.unit,
      date: l.date,
    })),
    medications: (p.medications ?? [])
      .filter((m: any) => m.status === 'active')
      .map((m: any) => m.display),
    dataCompleteness: Math.round((p.data_completeness?.score ?? 0) * 100),
  };
}

export const getPatients = async (): Promise<Patient[]> => {
  const res = await fetch(`${API_BASE}/api/patients`);
  if (!res.ok) throw new Error(`Failed to load patients (${res.status})`);
  const data = await res.json();
  return data.map(toPatient);
};

export const getPatientById = async (id: string): Promise<Patient | undefined> => {
  const res = await fetch(`${API_BASE}/api/patients/${id}`);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`Failed to load patient ${id} (${res.status})`);
  return toPatient(await res.json());
};

// Research patient IDs are the same as internal ids in this dataset.
export const getPatientByResearchId = getPatientById;
