import type { Account } from '../types/account';
import { API_BASE } from './apiBase';

export const getAccounts = async (): Promise<Account[]> => {
  const res = await fetch(`${API_BASE}/api/accounts`);
  if (!res.ok) throw new Error(`Failed to load accounts (${res.status})`);
  const data = await res.json();
  return data.map((a: any) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    initials: a.initials,
    specialty: a.specialty ?? '',
    assignedTrialIds: a.assigned_trial_ids ?? [],
  }));
};
