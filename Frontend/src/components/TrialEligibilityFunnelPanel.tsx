import { useEffect, useState } from 'react';
import { getTrialPatients } from '../services/matchingApi';
import type { Trial } from '../types/trial';
import type { MatchResult } from '../types/matching';
import FunnelChart from './charts/FunnelChart';
import { Filter, ClipboardList } from 'lucide-react';

interface TrialEligibilityFunnelPanelProps {
  trials: Trial[];
  selectedTrialId: string | null;
}

// Trial-level Patient Eligibility Funnel for the Trial Explorer's right
// column. Purely driven by whichever trial is selected on the left —
// no individual patient selection lives here.
export default function TrialEligibilityFunnelPanel({ trials, selectedTrialId }: TrialEligibilityFunnelPanelProps) {
  const [screeningResults, setScreeningResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedTrialId) { setScreeningResults([]); return; }
    setLoading(true);
    getTrialPatients(selectedTrialId)
      .then(setScreeningResults)
      .catch(() => setScreeningResults([]))
      .finally(() => setLoading(false));
  }, [selectedTrialId]);

  const selectedTrial = trials.find(t => t.id === selectedTrialId) ?? null;

  return (
    <div className="card" style={{ position: 'sticky', top: 16 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
        <Filter size={14} style={{ color: 'var(--accent)' }} />
        <span className="section-title" style={{ marginBottom: 0 }}>
          {selectedTrial ? `${selectedTrial.ctriId} — Patient Eligibility` : 'Patient Eligibility Funnel'}
        </span>
      </div>

      {!selectedTrialId ? (
        <div className="empty-state" style={{ padding: 24, textAlign: 'center' }}>
          <ClipboardList size={22} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Select a Trial
          </div>
          <p style={{ margin: 0 }}>Select a trial from the list to view its patient eligibility screening.</p>
        </div>
      ) : loading ? (
        <div className="loading-state"><div className="spinner" /> Loading screening data...</div>
      ) : screeningResults.length === 0 ? (
        <div className="empty-state" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Screening data unavailable
          </div>
          <p style={{ margin: 0 }}>No patient screening data available for this trial.</p>
        </div>
      ) : (
        <FunnelChart stages={buildFunnelStages(screeningResults)} />
      )}
    </div>
  );
}

// Same non-increasing five-stage clamp used on the Trial Details page, so
// the funnel always reads cleanly left-to-right / top-to-bottom.
function buildFunnelStages(screeningResults: MatchResult[]) {
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
  return [
    { label: 'Total Patients', value: stageCounts[0], color: '#45989F' },
    { label: 'Inclusion', value: stageCounts[1], color: '#3B8288' },
    { label: 'Exclusion Passed', value: stageCounts[2], color: '#2C676C' },
    { label: 'Needs Review', value: stageCounts[3], color: '#D97706' },
    { label: 'Eligible Patients', value: stageCounts[4], color: '#00A884' },
  ];
}
