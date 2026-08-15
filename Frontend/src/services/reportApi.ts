import type { StudyParticipant, DailyReport } from '../types/study';
import { STUDIES } from './studyApi';

// Get all reports for a specific participant in a study
export const getParticipantReports = (
  studyId: string,
  researchSubjectId: string
): Promise<DailyReport[]> =>
  new Promise(res =>
    setTimeout(() => {
      const study = STUDIES.find(s => s.id === studyId);
      const participant = study?.participants.find(p => p.researchSubjectId === researchSubjectId);
      res(participant?.reports ?? []);
    }, 200)
  );

// Get a single participant record
export const getParticipant = (
  studyId: string,
  researchSubjectId: string
): Promise<StudyParticipant | undefined> =>
  new Promise(res =>
    setTimeout(() => {
      const study = STUDIES.find(s => s.id === studyId);
      res(study?.participants.find(p => p.researchSubjectId === researchSubjectId));
    }, 200)
  );

// Get all participants across all studies (for the reports overview)
export const getAllParticipants = (): Promise<(StudyParticipant & { studyId: string })[]> =>
  new Promise(res =>
    setTimeout(() => {
      const all = STUDIES.flatMap(s =>
        s.participants.map(p => ({ ...p, studyId: s.id }))
      );
      res(all);
    }, 300)
  );
