import type { Trial, Criterion } from '../types/trial';
import { API_BASE } from './apiBase';

function toCriterion(c: any): Criterion {
  const s = c.structured ?? {};
  return {
    id: c.id,
    text: c.text,
    field: s.type === 'age_range' ? 'age' : (s.code ?? s.type),
    operator: s.operator,
    value: s.value ?? s.min ?? s.max ?? undefined,
    unit: s.unit,
  };
}

function toTrial(t: any): Trial {
  return {
    id: t.id,
    ctriId: (t.title as string).split(':')[0].trim(),
    title: t.title,
    condition: (t.condition ?? []).join(', '),
    phase: t.phase ?? 'Unknown',
    status: t.status ?? 'RECRUITING',
    sponsor: t.sponsor ?? 'Unspecified sponsor',
    locations: t.locations ?? [],
    inclusionCriteria: (t.eligibility?.inclusion ?? []).map(toCriterion),
    exclusionCriteria: (t.eligibility?.exclusion ?? []).map(toCriterion),
    startDate: t.start_date ?? '',
  };
}

// doctorId: pass the signed-in doctor's account id to get only their
// assigned trials; omit (or pass an Admin's id) to get every trial.
export const getTrials = async (doctorId?: string): Promise<Trial[]> => {
  const url = new URL(`${API_BASE}/api/trials`);
  if (doctorId) url.searchParams.set('doctor_id', doctorId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load trials (${res.status})`);
  const data = await res.json();
  return data.map(toTrial);
};

export const getTrialById = async (id: string): Promise<Trial | undefined> => {
  const res = await fetch(`${API_BASE}/api/trials/${id}`);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`Failed to load trial ${id} (${res.status})`);
  return toTrial(await res.json());
};
