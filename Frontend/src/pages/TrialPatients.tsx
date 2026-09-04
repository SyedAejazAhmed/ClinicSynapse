import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTrialById } from '../services/trialApi';
import { getTrialPatients } from '../services/matchingApi';
import type { Trial } from '../types/trial';
import type { MatchResult } from '../types/matching';
import StatusBadge from '../components/StatusBadge';
import CriteriaTable from '../components/CriteriaTable';
import { ArrowLeft, Users } from 'lucide-react';
import ErrorState from '../components/ErrorState';

export default function TrialPatients() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [trial, setTrial] = useState<Trial | null>(null);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getTrialById(id), getTrialPatients(id)])
      .then(([t, r]) => {
        if (cancelled) return;
        setTrial(t ?? null);
        setResults(r);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load trial patients.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, refreshKey]);

  if (loading) return <div className="loading-state"><div className="spinner" /> Loading trial patients...</div>;
  if (error) return <ErrorState message={error} onRetry={() => setRefreshKey(k => k + 1)} />;
  if (!trial) return <div className="empty-state"><p>Trial not found.</p></div>;

  const counts = {
    ELIGIBLE: results.filter(r => r.status === 'ELIGIBLE').length,
    NEEDS_REVIEW: results.filter(r => r.status === 'NEEDS_REVIEW').length,
    INELIGIBLE: results.filter(r => r.status === 'INELIGIBLE').length,
  };

  return (
    <div style={{ maxWidth: 820 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={13} /> Back
      </button>

      <div className="flex items-center justify-between mb-1">
        <div className="page-title" style={{ marginBottom: 2 }}>
          <Users size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
          {trial.ctriId} — Tested Patients
        </div>
      </div>
      <div className="page-subtitle">{trial.title}</div>

      <div className="flex gap-2 mb-4" style={{ marginBottom: 18 }}>
        <span className="badge badge-green">{counts.ELIGIBLE} Eligible</span>
        <span className="badge badge-amber">{counts.NEEDS_REVIEW} Needs Review</span>
        <span className="badge badge-red">{counts.INELIGIBLE} Ineligible</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
          {results.length} patients screened
        </span>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {results.map(r => (
          <div key={r.patientId}>
            <div
              onClick={() => setExpanded(expanded === r.patientId ? null : r.patientId)}
              className="flex items-center justify-between"
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-light)',
                cursor: 'pointer',
                background: expanded === r.patientId ? 'var(--accent-light)' : 'var(--surface)',
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--accent)', cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); nav(`/patients/${r.patientId}`); }}
                >
                  {r.patientId}
                </span>
                <StatusBadge status={r.status} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {r.inclusionMet}/{r.inclusionTotal} inclusion · {r.exclusionMet}/{r.exclusionTotal} exclusion
              </span>
            </div>
            {expanded === r.patientId && (
              <div style={{ padding: '14px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-light)' }}>
                <CriteriaTable criteria={r.criteria} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
