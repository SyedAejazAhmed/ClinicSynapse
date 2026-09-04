import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStudies } from '../services/studyApi';
import type { Study } from '../types/study';
import StatusBadge from '../components/StatusBadge';
import { ClipboardList, AlertTriangle, Users } from 'lucide-react';
import ErrorState from '../components/ErrorState';

export default function Studies() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getStudies()
      .then(s => { if (!cancelled) setStudies(s); })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load studies.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) return <div className="loading-state"><div className="spinner" /> Loading studies...</div>;
  if (error) return <ErrorState message={error} onRetry={() => setRefreshKey(k => k + 1)} />;

  return (
    <div>
      <div className="page-title">Studies</div>
      <div className="page-subtitle">{studies.length} active studies</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {studies.map(study => {
          const active = study.participants.filter(p => p.status === 'Active').length;

          return (
            <div key={study.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr' }}>

                {/* LEFT — general info */}
                <div style={{ padding: '16px 18px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px', marginBottom: 3 }}>{study.id}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{study.title}</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <MiniStat icon={<Users size={12} />} label="Participants" value={study.participants.length} />
                    <MiniStat icon={<Users size={12} />} label="Active" value={active} color="var(--green)" />
                    <MiniStat icon={<ClipboardList size={12} />} label="Reports Today" value={study.reportsToday} />
                    <MiniStat icon={<AlertTriangle size={12} />} label="Adverse Events" value={study.adverseEvents} color={study.adverseEvents > 10 ? 'var(--amber)' : undefined} />
                  </div>

                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 'auto' }} onClick={() => nav(`/studies/${study.id}`)}>
                    View Study
                  </button>
                </div>

                {/* RIGHT — participants table */}
                <div style={{ padding: '16px 18px' }}>
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

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
      <div className="flex items-center gap-1 text-muted text-xs mb-1">{icon}{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: color ?? 'var(--text-primary)', letterSpacing: '-0.5px' }}>{value}</div>
    </div>
  );
}
