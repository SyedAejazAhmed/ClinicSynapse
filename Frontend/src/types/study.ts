export interface Study {
  id: string;
  trialId: string;
  title: string;
  participants: StudyParticipant[];
  reportsToday: number;
  adverseEvents: number;
}

export interface StudyParticipant {
  id: string;
  researchSubjectId: string;
  status: 'Active' | 'Completed' | 'Review' | 'Withdrawn';
  enrolledDate: string;
  reports: DailyReport[];
}

export interface DailyReport {
  date: string;
  bloodGlucose: number;
  heartRate: number;
  bpSystolic: number;
  bpDiastolic: number;
  fatigue: 'None' | 'Mild' | 'Moderate' | 'Severe';
  notes?: string;
}
