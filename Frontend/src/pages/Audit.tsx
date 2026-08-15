import { useState } from 'react';
import { Shield, Clock, User, Filter } from 'lucide-react';

const AUDIT_LOGS = [
  { id: 'AL-001', action: 'Eligibility check run', subject: 'P-1024 → CTRI/2026/001', user: 'Dr. Meera Nair', time: '2026-08-15 14:32', type: 'match' },
  { id: 'AL-002', action: 'Trial criteria extracted', subject: 'CTRI/2026/001', user: 'System', time: '2026-08-15 12:10', type: 'extract' },
  { id: 'AL-003', action: 'Patient record accessed', subject: 'P-1025', user: 'Dr. Arjun Sharma', time: '2026-08-15 11:45', type: 'access' },
  { id: 'AL-004', action: 'Adverse event reported', subject: 'RS-0003 / DIAB-2026-001', user: 'Site Coordinator', time: '2026-08-15 09:20', type: 'alert' },
  { id: 'AL-005', action: 'Daily report submitted', subject: 'RS-0001 / DIAB-2026-001', user: 'RS-0001', time: '2026-08-15 08:05', type: 'report' },
  { id: 'AL-006', action: 'Patient enrolled', subject: 'P-1026 → DIAB-2026-001', user: 'Dr. Meera Nair', time: '2026-08-14 16:30', type: 'enroll' },
  { id: 'AL-007', action: 'Eligibility check run', subject: 'P-1025 → CTRI/2026/002', user: 'Dr. Arjun Sharma', time: '2026-08-14 14:00', type: 'match' },
];

const TYPE_COLOR: Record<string, string> = {
  match: 'var(--accent)',
  extract: 'var(--green)',
  access: 'var(--text-muted)',
  alert: 'var(--red)',
  report: 'var(--text-secondary)',
  enroll: 'var(--green)',
};

export default function Audit() {
  const [filter, setFilter] = useState('All');
  const types = ['All', 'match', 'extract', 'access', 'alert', 'report', 'enroll'];
  const filtered = filter === 'All' ? AUDIT_LOGS : AUDIT_LOGS.filter(l => l.type === filter);

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="flex items-center gap-2 mb-1">
        <Shield size={18} style={{ color: 'var(--accent)' }} />
        <div className="page-title" style={{ marginBottom: 0 }}>Audit Log</div>
      </div>
      <div className="page-subtitle">All system actions and data access events</div>

      <div className="card card-sm flex items-center gap-2 flex-wrap mb-4" style={{ marginBottom: 16 }}>
        <Filter size={13} style={{ color: 'var(--text-muted)' }} />
        {types.map(t => (
          <button
            key={t}
            className={`btn btn-sm ${filter === t ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(t)}
            style={{ textTransform: 'capitalize' }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Action</th>
              <th>Subject</th>
              <th>User</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(log => (
              <tr key={log.id}>
                <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>{log.id}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLOR[log.type], flexShrink: 0 }} />
                    <span style={{ fontWeight: 500 }}>{log.action}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{log.subject}</td>
                <td>
                  <div className="flex items-center gap-1 text-sm">
                    <User size={11} style={{ color: 'var(--text-muted)' }} />
                    {log.user}
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Clock size={11} />
                    {log.time}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
