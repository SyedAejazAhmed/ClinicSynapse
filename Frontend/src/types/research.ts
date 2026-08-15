export interface ResearchQuery {
  question: string;
  studyId: string;
}

export interface SourceCitation {
  id: string;
  label: string;
  type: 'report' | 'record' | 'document';
}

export interface ResearchResponse {
  answer: string;
  points: string[];
  basedOn: string;
  sources: SourceCitation[];
  followUps?: string[];
}
