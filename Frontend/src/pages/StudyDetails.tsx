import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStudyById } from '../services/studyApi';
import type { Study } from '../types/study';
import StatusBadge from '../components/StatusBadge';
import StudyReportChart from '../components/StudyReportChart';
import { ArrowLeft, ClipboardList, AlertTriangle, Users, Activity } from 'lucide-react';

export default function StudyDetails() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) getStudyById(id).then(s => { setStudy(s ?? null); setLoading(false); });
  }, [id]);

  if (loading) return <div className="loading-state"><div className="spinner" /> Loading study...</div>;
  if (!study) return <div className="empty-state"><p>Study not found.</p></div>;

  const active = study.participants.filter(p => p.status === 'Active').length;
  const completed = study.participants.filter(p => p.status === 'Completed').length;

  return (
    <div style={{ maxWidth: 920 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/studies')} style={{ marginBottom: 16 }}>
        <ArrowLeft size={13} /> Back to Studies
      </button>

      {/* Study header */}
      <div className="page-title">{study.id}</div>
      <div className="page-subtitle" style={{ marginBottom: 20 }}>{study.title}</div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatTile icon={<Users size={14} />} label="Participants" value={study.participants.length} />
        <StatTile icon={<Activity size={14} />} label="Active" value={active} color="var(--green)" />
        <StatTile icon={<Users size={14} />} label="Completed" value={completed} color="var(--text-secondary)" />
        <StatTile icon={<ClipboardList size={14} />} label="Reports Today" value={study.reportsToday} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {/* Adverse events */}
        <div className="card" style={{ borderLeft: study.adverseEvents > 10 ? '3px solid var(--amber)' : '3px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} style={{ color: study.adverseEvents > 10 ? 'var(--amber)' : 'var(--text-muted)' }} />
            <span className="section-title" style={{ marginBottom: 0 }}>Adverse Events</span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1.5px', color: study.adverseEvents > 10 ? 'var(--amber)' : 'var(--text-primary)' }}>
            {study.adverseEvents}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {study.adverseEvents > 10 ? 'Above threshold — review recommended' : 'Within normal range'}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="card">
          <div className="section-title">Participant Status</div>
          {[
            { label: 'Active', count: active, color: 'var(--green)' },
            { label: 'Review', count: study.participants.filter(p => p.status === 'Review').length, color: 'var(--amber)' },
            { label: 'Completed', count: completed, color: 'var(--text-muted)' },
            { label: 'Withdrawn', count: study.participants.filter(p => p.status === 'Withdrawn').length, color: 'var(--red)' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.label}</span>
              <span style={{ fontWeight: 650, fontSize: 13, color: s.color }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Study Report — interactive daily clinical measurements chart */}
      <div className="section-title" style={{ marginBottom: 12 }}>Study Report</div>
      <StudyReportChart study={study} />

      {/* Participants table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Participants</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Subject ID</th>
              <th>Status</th>
              <th>Enrolled</th>
              <th>Reports</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {study.participants.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.researchSubjectId}</td>
                <td><StatusBadge status={p.status} /></td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {new Date(p.enrolledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{p.reports.length}</td>
                <td>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => nav(`/reports/${study.id}/${p.researchSubjectId}`)}
                  >
                    View Reports
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div className="stat-card" style={{ padding: '14px 16px' }}>
      <div className="flex items-center gap-1 text-xs text-muted" style={{ marginBottom: 6 }}>
        <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.8px', color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}
