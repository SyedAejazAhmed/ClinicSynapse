export interface Account {
  id: string;
  name: string;
  role: 'ADMIN' | 'DOCTOR';
  initials: string;
  assignedTrialIds: string[];
}
