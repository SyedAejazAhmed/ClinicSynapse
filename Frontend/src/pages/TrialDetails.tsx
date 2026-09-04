import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTrialById } from '../services/trialApi';
import { getTrialPatients } from '../services/matchingApi';
import { getStudies } from '../services/studyApi';
import type { Trial } from '../types/trial';
import type { MatchResult } from '../types/matching';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeft, MapPin, Building2, Users, FileText, Loader2, Filter, Activity } from 'lucide-react';
import { exportTrialDocumentation } from '../utils/exportTrialDocumentation';
import FunnelChart from '../components/charts/FunnelChart';
import DonutChart from '../components/charts/DonutChart';
import ErrorState from '../components/ErrorState';

export default function TrialDetails() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [trial, setTrial] = useState<Trial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [screeningResults, setScreeningResults] = useState<MatchResult[]>([]);
  const [participantStatus, setParticipantStatus] = useState<{ active: number; withdrawn: number; completed: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTrialById(id)
      .then(t => { if (!cancelled) setTrial(t ?? null); })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load trial.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, refreshKey]);

  // Eligibility funnel data — reuses the same screening results the
  // "Tested Patients" view is built from.
  useEffect(() => {
    if (id) getTrialPatients(id).then(setScreeningResults).catch(() => setScreeningResults([]));
  }, [id]);

  // Patient status donut — a trial's day-to-day participant status lives on
  // the linked Study record, so find the study whose trialId matches.
  useEffect(() => {
    if (!id) return;
    getStudies().then(studies => {
      const study = studies.find(s => s.trialId === id);
      if (!study) { setParticipantStatus(null); return; }
      setParticipantStatus({
        active: study.participants.filter(p => p.status === 'Active' || p.status === 'Review').length,
        withdrawn: study.participants.filter(p => p.status === 'Withdrawn').length,
        completed: study.participants.filter(p => p.status === 'Completed').length,
      });
    }).catch(() => setParticipantStatus(null));
  }, [id]);

  async function handleExportDocumentation() {
    if (!trial) return;
    setExporting(true);
    try {
      const results = await getTrialPatients(trial.id);
      exportTrialDocumentation(trial, results);
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div className="loading-state"><div className="spinner" /> Loading trial...</div>;
  if (error) return <ErrorState message={error} onRetry={() => setRefreshKey(k => k + 1)} />;
  if (!trial) return <div className="empty-state"><p>Trial not found.</p></div>;

  // Patient eligibility funnel — five sequential screening stages, clamped
  // to be non-increasing so the funnel always reads cleanly left-to-right.
  const rawStageCounts = [
    screeningResults.length,
    screeningResults.filter(r => r.inclusionTotal === 0 || r.inclusionMet === r.inclusionTotal).length,
    screeningResults.filter(r =>
      (r.inclusionTotal === 0 || r.inclusionMet === r.inclusionTotal) &&
      (r.exclusionTotal === 0 || r.exclusionMet === r.exclusionTotal)
    ).length,
    screeningResults.filter(r => r.status === 'NEEDS_REVIEW').length,
    screeningResults.filter(r => r.status === 'ELIGIBLE').length,
  ];
  const stageCounts: number[] = [];
  rawStageCounts.forEach((v, i) => stageCounts.push(i === 0 ? v : Math.min(v, stageCounts[i - 1])));
  const funnelStages = [
    { label: 'Total Patients', value: stageCounts[0], color: '#45989F' },
    { label: 'Inclusion', value: stageCounts[1], color: '#3B8288' },
    { label: 'Exclusion Passed', value: stageCounts[2], color: '#2C676C' },
    { label: 'Needs Review', value: stageCounts[3], color: '#D97706' },
    { label: 'Eligible Patients', value: stageCounts[4], color: '#00A884' },
  ];
  const participantTotal = participantStatus
    ? participantStatus.active + participantStatus.withdrawn + participantStatus.completed
    : 0;

  return (
    <div>
      <button className="btn btn-ghost btn-sm mb-3" onClick={() => nav(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={13} /> Back
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 14, alignItems: 'stretch' }}>

        {/* LEFT — header info */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>{trial.ctriId}</span>
            <StatusBadge status={trial.status} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, letterSpacing: '-0.3px' }}>
            {trial.title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
            <InfoRow icon={<Building2 size={13} />} label="Sponsor" value={trial.sponsor} />
            <InfoRow icon={null} label="Phase" value={trial.phase} />
            <InfoRow icon={null} label="Start Date" value={new Date(trial.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
            <InfoRow icon={<MapPin size={13} />} label="Locations" value={trial.locations.join(' · ')} />
          </div>
        </div>

        {/* RIGHT — eligibility criteria */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 14 }}>Eligibility Criteria</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
                Inclusion
              </div>
              {trial.inclusionCriteria.map(c => (
                <div key={c.id} className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                  <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.text}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
                Exclusion
              </div>
              {trial.exclusionCriteria.map(c => (
                <div key={c.id} className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                  <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>✕</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Analytics — eligibility funnel + patient status breakdown */}
      <div className="trial-analytics-grid">
        <div className="card">
          <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
            <Filter size={14} style={{ color: 'var(--accent)' }} />
            <span className="section-title" style={{ marginBottom: 0 }}>Patient Eligibility Funnel</span>
          </div>
          {screeningResults.length > 0 ? (
            <FunnelChart stages={funnelStages} />
          ) : (
            <div className="empty-state" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                No Trials Running
              </div>
              <p style={{ margin: 0 }}>No trial data available for the eligibility funnel yet.</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
            <Activity size={14} style={{ color: 'var(--accent)' }} />
            <span className="section-title" style={{ marginBottom: 0 }}>Trial Patient Status</span>
          </div>
          {participantStatus ? (
            <DonutChart
              centerValue={participantTotal}
              centerLabel="Patients"
              segments={[
                { label: 'Active / Ongoing', value: participantStatus.active, color: 'var(--green)' },
                { label: 'Withdrawn', value: participantStatus.withdrawn, color: 'var(--red)' },
                { label: 'Completed', value: participantStatus.completed, color: '#64748B' },
              ]}
            />
          ) : (
            <div className="empty-state" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                No Trials Running
              </div>
              <p style={{ margin: 0 }}>There are currently no active clinical trials to display.</p>
            </div>
          )}
        </div>
      </div>

      {/* Buttons — centered below both cards */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
        <button className="btn btn-primary" onClick={() => nav(`/matching?trialId=${trial.id}`)}>
          <Users size={13} /> Find Matching Patients
        </button>
        <button className="btn btn-secondary" onClick={() => nav(`/trials/${trial.id}/patients`)}>
          <Users size={13} /> View Tested Patients
        </button>
        <button className="btn btn-secondary" onClick={handleExportDocumentation} disabled={exporting}>
          {exporting ? <Loader2 size={13} className="spin" /> : <FileText size={13} />}
          {exporting ? 'Generating...' : 'Documentation'}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted font-semibold" style={{ marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div className="flex items-center gap-1" style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
        {icon && <span style={{ color: 'var(--text-muted)' }}>{icon}</span>}
        {value}
      </div>
    </div>
  );
}
