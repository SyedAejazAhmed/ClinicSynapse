import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStudies } from '../services/studyApi';
import type { Study } from '../types/study';
import StatusBadge from '../components/StatusBadge';
import { Search, ClipboardList } from 'lucide-react';

export default function ReportsOverview() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const nav = useNavigate();

  useEffect(() => {
    getStudies().then(s => { setStudies(s); setLoading(false); });
  }, []);

  // Flatten all participants across all studies for the overview
  const allParticipants = studies.flatMap(study =>
    study.participants.map(p => ({ ...p, studyId: study.id, studyTitle: study.title }))
  );

  const filtered = allParticipants.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.researchSubjectId.toLowerCase().includes(q) || p.studyId.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <div className="loading-state"><div className="spinner" /> Loading reports...</div>;

  return (
    <div>
      <div className="page-title">Reports</div>
      <div className="page-subtitle">
        {allParticipants.length} participants across {studies.length} {studies.length === 1 ? 'study' : 'studies'}
      </div>

      {/* Filters */}
      <div className="card card-sm flex items-center gap-3 flex-wrap" style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 30 }}
            placeholder="Search by subject ID or study..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {['All', 'Active', 'Review', 'Completed', 'Withdrawn'].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Per-study sections */}
      {studies.map(study => {
        const studyParticipants = filtered.filter(p => p.studyId === study.id);
        if (studyParticipants.length === 0) return null;

        return (
          <div key={study.id} className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
            {/* Study header */}
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface-2)',
              }}
            >
              <div className="flex items-center gap-2">
                <ClipboardList size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 650, fontSize: 14 }}>{study.id}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>· {study.title}</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => nav(`/studies/${study.id}`)}>
                Study Details
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject ID</th>
                  <th>Status</th>
                  <th>Enrolled</th>
                  <th>Reports</th>
                  <th>Latest Entry</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {studyParticipants.map(p => {
                  const latest = p.reports[0];
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.researchSubjectId}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {new Date(p.enrolledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.reports.length}</td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {latest
                          ? new Date(latest.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                          : '—'}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => nav(`/reports/${p.studyId}/${p.researchSubjectId}`)}
                        >
                          View Timeline
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="empty-state">
          <p>No participants match your filters.</p>
        </div>
      )}
    </div>
  );
}
