import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStudies } from '../services/studyApi';
import type { Study } from '../types/study';
import StatusBadge from '../components/StatusBadge';
import { ClipboardList, AlertTriangle, Users } from 'lucide-react';

export default function Studies() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    getStudies().then(s => { setStudies(s); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-state"><div className="spinner" /> Loading studies...</div>;

  return (
    <div>
      <div className="page-title">Studies</div>
      <div className="page-subtitle">{studies.length} active studies</div>

      {studies.map(study => {
        const active = study.participants.filter(p => p.status === 'Active').length;

        return (
          <div key={study.id} className="card" style={{ marginBottom: 16, maxWidth: 720 }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>{study.id}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => nav(`/studies/${study.id}`)}>
                View Study
              </button>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 16 }}>{study.title}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              <MiniStat icon={<Users size={13} />} label="Participants" value={study.participants.length} />
              <MiniStat icon={<Users size={13} />} label="Active" value={active} color="var(--green)" />
              <MiniStat icon={<ClipboardList size={13} />} label="Reports Today" value={study.reportsToday} />
              <MiniStat icon={<AlertTriangle size={13} />} label="Adverse Events" value={study.adverseEvents} color={study.adverseEvents > 10 ? 'var(--amber)' : undefined} />
            </div>

            <div className="section-title" style={{ marginBottom: 8 }}>Participants</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject ID</th>
                  <th>Status</th>
                  <th>Enrolled</th>
                  <th>Reports</th>
                </tr>
              </thead>
              <tbody>
                {study.participants.map(p => (
                  <tr
                    key={p.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => nav(`/reports/${study.id}/${p.researchSubjectId}`)}
                  >
                    <td style={{ fontWeight: 600 }}>{p.researchSubjectId}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(p.enrolledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{p.reports.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
      <div className="flex items-center gap-1 text-muted text-xs mb-1">{icon}{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--text-primary)', letterSpacing: '-0.5px' }}>{value}</div>
    </div>
  );
}
