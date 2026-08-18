import type { MatchResult, CriterionMatch, CriterionResult } from '../types/matching';
import { API_BASE } from './apiBase';

function toCriterionMatch(c: any): CriterionMatch {
  return {
    id: c.criterion_id,
    label: c.criterion,
    required: c.requirement,
    patientValue: c.patient_value,
    result: (c.status === 'REVIEW' ? 'MISSING' : c.status) as CriterionResult,
    type: c.category,
    source: c.evidence,
  };
}

function toMatchResult(m: any): MatchResult {
  const criteria = (m.criteria_results ?? []).map(toCriterionMatch);
  const inclusion = criteria.filter((c: CriterionMatch) => c.type === 'inclusion');
  const exclusion = criteria.filter((c: CriterionMatch) => c.type === 'exclusion');
  return {
    patientId: m.patient_id,
    trialId: m.trial_id,
    status: m.overall_status,
    inclusionMet: inclusion.filter((c: CriterionMatch) => c.result === 'PASS').length,
    inclusionTotal: inclusion.length,
    exclusionMet: exclusion.filter((c: CriterionMatch) => c.result === 'PASS').length,
    exclusionTotal: exclusion.length,
    criteria,
  };
}

export const runMatching = async (patientId: string, trialId: string): Promise<MatchResult> => {
  const res = await fetch(`${API_BASE}/api/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: patientId, trial_id: trialId }),
  });
  if (!res.ok) throw new Error(`Match request failed (${res.status})`);
  return toMatchResult(await res.json());
};

export const getScreeningReport = async (patientId: string): Promise<MatchResult[]> => {
  const res = await fetch(`${API_BASE}/api/screening-report/${patientId}`);
  if (!res.ok) throw new Error(`Screening report request failed (${res.status})`);
  const data = await res.json();
  return data.map(toMatchResult);
};

// Every patient matched against one trial — backs the doctor portal's
// "this trial's tested patient data" view.
export const getTrialPatients = async (trialId: string): Promise<MatchResult[]> => {
  const res = await fetch(`${API_BASE}/api/trials/${trialId}/patients`);
  if (!res.ok) throw new Error(`Trial patients request failed (${res.status})`);
  const data = await res.json();
  return data.map(toMatchResult);
};
