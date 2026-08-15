export type MatchStatus = 'ELIGIBLE' | 'NEEDS_REVIEW' | 'INELIGIBLE';
export type CriterionResult = 'PASS' | 'FAIL' | 'MISSING';

export interface CriterionMatch {
  id: string;
  label: string;
  required: string;
  patientValue: string;
  result: CriterionResult;
  type: 'inclusion' | 'exclusion';
  source?: string;
  sourceDate?: string;
  unit?: string;
}

export interface MatchResult {
  patientId: string;
  trialId: string;
  status: MatchStatus;
  inclusionMet: number;
  inclusionTotal: number;
  exclusionMet: number;
  exclusionTotal: number;
  criteria: CriterionMatch[];
}
