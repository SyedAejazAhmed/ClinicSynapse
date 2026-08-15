import type { StudyParticipant, DailyReport } from '../types/study';
import { getStudies, getStudyById } from './studyApi';

// Get all reports for a specific participant in a study
export const getParticipantReports = async (
  studyId: string,
  researchSubjectId: string
): Promise<DailyReport[]> => {
  const study = await getStudyById(studyId);
  return study?.participants.find(p => p.researchSubjectId === researchSubjectId)?.reports ?? [];
};

// Get a single participant record
export const getParticipant = async (
  studyId: string,
  researchSubjectId: string
): Promise<StudyParticipant | undefined> => {
  const study = await getStudyById(studyId);
  return study?.participants.find(p => p.researchSubjectId === researchSubjectId);
};

// Get all participants across all studies (for the reports overview)
export const getAllParticipants = async (): Promise<(StudyParticipant & { studyId: string })[]> => {
  const studies = await getStudies();
  return studies.flatMap(s => s.participants.map(p => ({ ...p, studyId: s.id })));
};
