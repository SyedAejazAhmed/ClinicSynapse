import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitMerge, FlaskConical, AlertTriangle, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/apiBase';
import { getTrials } from '../services/trialApi';
import { getPatients } from '../services/patientApi';
import DonutChart from '../components/charts/DonutChart';
import MiniCalendar from '../components/MiniCalendar';
import TrialGrowthChart from '../components/TrialGrowthChart';
import ErrorState from '../components/ErrorState';
import type { Trial } from '../types/trial';

interface Stats {
  trials: number;
  patients: number;
  matches: number;
  eligibility: { ELIGIBLE: number; NEEDS_REVIEW: number; INELIGIBLE: number };
}

interface TrialStatusBreakdown {
  completed: number;
  undergoing: number;
}

interface PatientGenderBreakdown {
  male: number;
  female: number;
  other: number;
}

export default function Dashboard() {
  const nav = useNavigate();
  const { account } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trialStatus, setTrialStatus] = useState<TrialStatusBreakdown>({ completed: 0, undergoing: 0 });
  const [patientGender, setPatientGender] = useState<PatientGenderBreakdown>({ male: 0, female: 0, other: 0 });
  const [trials, setTrials] = useState<Trial[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Primary stats — this alone gates the page's loading spinner, exactly
  // like the original dashboard, so the page doesn't wait on trials/patients.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = new URL(`${API_BASE}/api/stats`);
    if (account?.role === 'DOCTOR') url.searchParams.set('doctor_id', account.id);

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load dashboard stats (${res.status})`);
        return res.json();
      })
      .then(statsData => {
        if (!cancelled) setStats(statsData);
      })
      .catch(err => {
        if (cancelled) return;
        // Surfaces backend outages (server down, 5xx, network errors) with a
        // clear message + retry instead of leaving the dashboard spinning.
        setError(err instanceof Error ? err.message : 'Something went wrong while loading the dashboard.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [account, refreshKey]);

  // Trial status, patient gender, and the Trial Growth chart's data are all
  // derived client-side from the existing trials/patients lists. These run
  // independently in the background and populate their widgets whenever
  // they resolve — they never block the main dashboard spinner above, so a
  // slow trials/patients response doesn't hold up the whole page.
  useEffect(() => {
    let cancelled = false;
    const doctorId = account?.role === 'DOCTOR' ? account.id : undefined;

    getTrials(doctorId)
      .then(trialsData => {
        if (cancelled) return;
        const completed = trialsData.filter(t => t.status === 'COMPLETED').length;
        setTrialStatus({ completed, undergoing: trialsData.length - completed });
        setTrials(trialsData);
      })
      .catch(() => {
        // Non-blocking widget: fail quietly and leave it at its zeroed
        // default rather than surfacing a second error state on the page.
      });

    getPatients(doctorId)
      .then(patientsData => {
        if (cancelled) return;
        setPatientGender({
          male: patientsData.filter(p => p.sex === 'Male').length,
          female: patientsData.filter(p => p.sex === 'Female').length,
          other: patientsData.filter(p => p.sex === 'Other').length,
        });
      })
      .catch(() => {
        // Same as above — non-blocking, fails quietly.
      });

    return () => {
      cancelled = true;
    };
  }, [account, refreshKey]);

  if (loading) {
    return <div className="loading-state"><div className="spinner" /> Loading dashboard...</div>;
  }

  if (error || !stats) {
    return (
      <ErrorState
        message={error ?? "Couldn't reach the server. Please check your connection and try again."}
        onRetry={() => setRefreshKey(k => k + 1)}
      />
    );
  }

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

      <div className="analytics-grid">
        {/* Total Trials — dominant center number with status donut */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>Total Trials</div>
          <DonutChart
            centerValue={stats.trials}
            centerLabel="Trials"
            segments={[
              { label: 'Undergoing', value: trialStatus.undergoing, color: 'var(--accent)' },
              { label: 'Completed', value: trialStatus.completed, color: 'var(--border)' },
            ]}
          />
        </div>

        {/* Total Patients — smaller companion summary with gender split */}
        <div className="card">
          <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
            <Users size={14} style={{ color: 'var(--accent)' }} />
            <span className="section-title" style={{ marginBottom: 0 }}>Total Patients</span>
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.8px', marginBottom: 12 }}>
            {stats.patients.toLocaleString('en-IN')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Male', count: patientGender.male, color: 'var(--accent)' },
              { label: 'Female', count: patientGender.female, color: 'var(--pink)' },
            ].map(g => {
              const pct = stats.patients > 0 ? Math.round((g.count / stats.patients) * 100) : 0;
              return (
                <div key={g.label}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{g.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{g.count}</span>
                  </div>
                  <div className="progress-bar" style={{ height: 5 }}>
                    <div className="progress-fill" style={{ width: `${pct}%`, background: g.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Calendar — dates, selection, and important-date markers */}
        <MiniCalendar />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginBottom: 20 }}>
        {/* Trial Growth — cumulative monthly trial count, derived from real trial start dates */}
        <TrialGrowthChart trials={trials} />

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
