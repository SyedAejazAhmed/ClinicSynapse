import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStudyById } from '../services/studyApi';
import type { Study, StudyParticipant } from '../types/study';
import ReportTimeline from '../components/ReportTimeline';
import StatusBadge from '../components/StatusBadge';
import StudyReportChart, { OVERALL_SCOPE } from '../components/StudyReportChart';
import { ArrowLeft } from 'lucide-react';

export default function Reports() {
  const { studyId, subjectId } = useParams<{ studyId: string; subjectId: string }>();
  const nav = useNavigate();
  const [study, setStudy] = useState<Study | null>(null);
  const [participant, setParticipant] = useState<StudyParticipant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studyId) {
      getStudyById(studyId).then(s => {
        setStudy(s ?? null);
        if (s && subjectId) {
          setParticipant(s.participants.find(p => p.researchSubjectId === subjectId) ?? null);
        }
        setLoading(false);
      });
    }
  }, [studyId, subjectId]);

  if (loading) return <div className="loading-state"><div className="spinner" /> Loading reports...</div>;
  if (!study || !participant) return <div className="empty-state"><p>Participant not found.</p></div>;

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={13} /> Back to Study
      </button>

      <div className="flex items-center justify-between mb-4" style={{ marginBottom: 20 }}>
        <div>
          <div className="page-title">Study Report</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{study.id} · Daily clinical measurements</div>
        </div>
        <StatusBadge status={participant.status} />
      </div>

      <StudyReportChart study={study} defaultScope={OVERALL_SCOPE} />

      <div className="section-title" style={{ marginBottom: 4 }}>Timeline — {participant.researchSubjectId}</div>
      <ReportTimeline reports={participant.reports} />
    </div>
  );
}
