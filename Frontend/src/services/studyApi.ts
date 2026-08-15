import type { Study, StudyParticipant, DailyReport } from '../types/study';
import { API_BASE } from './apiBase';

function toReport(r: any): DailyReport {
  return {
    date: r.date,
    bloodGlucose: r.blood_glucose,
    heartRate: r.heart_rate,
    bpSystolic: r.bp_systolic,
    bpDiastolic: r.bp_diastolic,
    fatigue: r.fatigue,
    notes: r.adverse_event ? `${r.adverse_event}${r.notes ? ` ${r.notes}` : ''}` : r.notes,
  };
}

function toParticipant(p: any): StudyParticipant {
  return {
    id: p.patient_id,
    researchSubjectId: p.research_subject_id,
    status: p.status,
    enrolledDate: p.enrolled_date,
    // Backend stores reports oldest-first; the UI expects most-recent-first.
    reports: (p.reports ?? []).map(toReport).reverse(),
  };
}

function toStudy(s: any): Study {
  const participants: StudyParticipant[] = (s.participants ?? []).map(toParticipant);
  const allReports = participants.flatMap(p => p.reports);
  const latestDate = allReports.reduce((max, r) => (r.date > max ? r.date : max), '');
  const reportsToday = allReports.filter(r => r.date === latestDate).length;
  const adverseEvents: number = (s.participants ?? [])
    .flatMap((p: any) => p.reports ?? [])
    .filter((r: any) => r.adverse_event).length;

  return {
    id: s.id,
    trialId: s.trial_id,
    title: s.title,
    participants,
    reportsToday,
    adverseEvents,
  };
}

export const getStudies = async (): Promise<Study[]> => {
  const res = await fetch(`${API_BASE}/api/studies`);
  if (!res.ok) throw new Error(`Failed to load studies (${res.status})`);
  const data = await res.json();
  return data.map(toStudy);
};

export const getStudyById = async (id: string): Promise<Study | undefined> => {
  const res = await fetch(`${API_BASE}/api/studies/${id}`);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`Failed to load study ${id} (${res.status})`);
  return toStudy(await res.json());
};
