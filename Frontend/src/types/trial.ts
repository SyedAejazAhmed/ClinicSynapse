export interface Trial {
  id: string;
  ctriId: string;
  title: string;
  condition: string;
  phase: string;
  status: 'RECRUITING' | 'COMPLETED' | 'SUSPENDED' | 'NOT_YET_RECRUITING';
  sponsor: string;
  locations: string[];
  inclusionCriteria: Criterion[];
  exclusionCriteria: Criterion[];
  startDate: string;
  endDate?: string;
}

export interface Criterion {
  id: string;
  text: string;
  field?: string;
  operator?: string;
  value?: string | number;
  unit?: string;
}
