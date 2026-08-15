import type { Study } from '../types/study';

export const STUDIES: Study[] = [
  {
    id: 'DIAB-2026-001',
    trialId: '1',
    title: 'Type 2 Diabetes Glycemic Control',
    reportsToday: 114,
    adverseEvents: 17,
    participants: [
      {
        id: '1',
        researchSubjectId: 'RS-0001',
        status: 'Active',
        enrolledDate: '2026-02-01',
        reports: [
          { date: '2026-08-15', bloodGlucose: 128, heartRate: 76, bpSystolic: 122, bpDiastolic: 78, fatigue: 'Mild' },
          { date: '2026-08-14', bloodGlucose: 132, heartRate: 79, bpSystolic: 125, bpDiastolic: 80, fatigue: 'None' },
          { date: '2026-08-13', bloodGlucose: 119, heartRate: 74, bpSystolic: 118, bpDiastolic: 76, fatigue: 'None' },
          { date: '2026-08-12', bloodGlucose: 141, heartRate: 82, bpSystolic: 130, bpDiastolic: 84, fatigue: 'Mild' },
          { date: '2026-08-11', bloodGlucose: 136, heartRate: 77, bpSystolic: 124, bpDiastolic: 79, fatigue: 'None' },
        ],
      },
      {
        id: '2',
        researchSubjectId: 'RS-0002',
        status: 'Active',
        enrolledDate: '2026-02-03',
        reports: [
          { date: '2026-08-15', bloodGlucose: 145, heartRate: 81, bpSystolic: 138, bpDiastolic: 88, fatigue: 'None' },
          { date: '2026-08-14', bloodGlucose: 152, heartRate: 84, bpSystolic: 142, bpDiastolic: 90, fatigue: 'Mild' },
          { date: '2026-08-13', bloodGlucose: 148, heartRate: 80, bpSystolic: 136, bpDiastolic: 86, fatigue: 'None' },
        ],
      },
      {
        id: '3',
        researchSubjectId: 'RS-0003',
        status: 'Review',
        enrolledDate: '2026-02-05',
        reports: [
          { date: '2026-08-15', bloodGlucose: 198, heartRate: 92, bpSystolic: 148, bpDiastolic: 94, fatigue: 'Moderate' },
          { date: '2026-08-14', bloodGlucose: 204, heartRate: 95, bpSystolic: 152, bpDiastolic: 96, fatigue: 'Severe' },
        ],
      },
      {
        id: '4',
        researchSubjectId: 'RS-0004',
        status: 'Active',
        enrolledDate: '2026-02-07',
        reports: [
          { date: '2026-08-15', bloodGlucose: 112, heartRate: 70, bpSystolic: 115, bpDiastolic: 72, fatigue: 'None' },
          { date: '2026-08-14', bloodGlucose: 118, heartRate: 72, bpSystolic: 118, bpDiastolic: 74, fatigue: 'None' },
        ],
      },
    ],
  },
];

export const getStudies = (): Promise<Study[]> =>
  new Promise(res => setTimeout(() => res(STUDIES), 300));

export const getStudyById = (id: string): Promise<Study | undefined> =>
  new Promise(res => setTimeout(() => res(STUDIES.find(s => s.id === id)), 200));
