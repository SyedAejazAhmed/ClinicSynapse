import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitMerge, FlaskConical, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/apiBase';

interface Stats {
  trials: number;
  patients: number;
  matches: number;
  eligibility: { ELIGIBLE: number; NEEDS_REVIEW: number; INELIGIBLE: number };
}

export default function Dashboard() {
  const nav = useNavigate();
  const { account } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = new URL(`${API_BASE}/api/stats`);
    if (account?.role === 'DOCTOR') url.searchParams.set('doctor_id', account.id);
    fetch(url)
      .then(res => res.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, [account]);

  if (loading || !stats) {
    return <div className="loading-state"><div className="spinner" /> Loading dashboard...</div>;
  }

  const total = stats.matches || 1;
  const ELIGIBILITY = [
    { label: 'Eligible', count: stats.eligibility.ELIGIBLE, color: 'var(--green)', bg: 'var(--green-bg)', pct: Math.round((stats.eligibility.ELIGIBLE / total) * 100) },
    { label: 'Needs Review', count: stats.eligibility.NEEDS_REVIEW, color: 'var(--amber)', bg: 'var(--amber-bg)', pct: Math.round((stats.eligibility.NEEDS_REVIEW / total) * 100) },
    { label: 'Ineligible', count: stats.eligibility.INELIGIBLE, color: 'var(--red)', bg: 'var(--red-bg)', pct: Math.round((stats.eligibility.INELIGIBLE / total) * 100) },
  ];
  const STAT_CARDS = [
    { value: String(stats.trials), label: account?.role === 'DOCTOR' ? 'My Trials' : 'Trials' },
    { value: stats.patients.toLocaleString('en-IN'), label: 'Patients' },
    { value: stats.matches.toLocaleString('en-IN'), label: 'Match Evaluations' },
  ];

  return (
    <div>
      <div className="page-title">Clinical Research Dashboard</div>
      <div className="page-subtitle">
        {account?.role === 'DOCTOR'
          ? `Overview of your assigned trials, computed live from ${stats.patients} patient records`
          : 'Overview of every trial, patient, and matching outcome — computed live, not cached'}
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {STAT_CARDS.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div className="section-title" style={{ marginBottom: 14 }}>Match Status</div>
          {ELIGIBILITY.map(e => (
            <div
              key={e.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: e.bg,
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{e.label}</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: e.color, letterSpacing: '-0.3px' }}>{e.count}</span>
            </div>
          ))}
          <div style={{ marginTop: 14 }}>
            {ELIGIBILITY.map(e => (
              <div key={e.label} style={{ marginBottom: 6 }}>
                <div className="progress-bar" style={{ height: 5 }}>
                  <div className="progress-fill" style={{ width: `${e.pct}%`, background: e.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-title" style={{ marginBottom: 14 }}>How These Numbers Are Computed</div>
          <div className="flex" style={{ gap: 12, marginBottom: 14 }}>
            <IconNote icon={FlaskConical} color="var(--accent)" bg="var(--accent-light)"
              text={`${stats.trials} trial(s) × ${stats.patients} patients = ${stats.matches} deterministic eligibility evaluations, run fresh on every dashboard load.`} />
          </div>
          <div className="flex" style={{ gap: 12, marginBottom: 14 }}>
            <IconNote icon={GitMerge} color="var(--green)" bg="var(--green-bg)"
              text="Every evaluation is a plain rule check against structured trial criteria — no LLM is involved in the eligibility decision." />
          </div>
          <div className="flex" style={{ gap: 12 }}>
            <IconNote icon={AlertTriangle} color="var(--amber)" bg="var(--amber-bg)"
              text={`${stats.eligibility.NEEDS_REVIEW} evaluation(s) need human review — usually missing lab data or a free-text criterion that can't be checked automatically.`} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>Quick Actions</div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => nav('/trials')}>Browse Trials</button>
          <button className="btn btn-secondary" onClick={() => nav('/matching')}>Run Matching</button>
          <button className="btn btn-secondary" onClick={() => nav('/patients')}>Search Patients</button>
          {account?.role === 'ADMIN' && <button className="btn btn-secondary" onClick={() => nav('/studies')}>View Studies</button>}
        </div>
      </div>
    </div>
  );
}

function IconNote({ icon: Icon, color, bg, text }: { icon: typeof FlaskConical; color: string; bg: string; text: string }) {
  return (
    <>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</div>
    </>
  );
}
