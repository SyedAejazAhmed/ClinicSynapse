import type { MatchStatus } from '../types/matching';

interface MatchScoreProps {
  status: MatchStatus;
  inclusionMet: number;
  inclusionTotal: number;
  exclusionMet: number;
  exclusionTotal: number;
}

const STATUS_CONFIG: Record<MatchStatus, { label: string; color: string; bg: string; dot: string }> = {
  ELIGIBLE:     { label: 'Eligible',     color: 'var(--green)', bg: 'var(--green-bg)', dot: '🟢' },
  NEEDS_REVIEW: { label: 'Needs Review', color: 'var(--amber)', bg: 'var(--amber-bg)', dot: '🟡' },
  INELIGIBLE:   { label: 'Ineligible',   color: 'var(--red)',   bg: 'var(--red-bg)',   dot: '🔴' },
};

export default function MatchScore({ status, inclusionMet, inclusionTotal, exclusionMet, exclusionTotal }: MatchScoreProps) {
  const cfg = STATUS_CONFIG[status];
  const inclPct = inclusionTotal > 0 ? (inclusionMet / inclusionTotal) * 100 : 0;
  const exclPct = exclusionTotal > 0 ? (exclusionMet / exclusionTotal) * 100 : 0;

  return (
    <div>
      {/* Verdict pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: cfg.bg,
          color: cfg.color,
          fontWeight: 700,
          fontSize: 13,
          padding: '4px 14px',
          borderRadius: 20,
          marginBottom: 16,
        }}
      >
        {cfg.dot} {cfg.label}
      </div>

      {/* Inclusion score bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Inclusion</span>
          <span style={{ fontWeight: 600, color: inclPct === 100 ? 'var(--green)' : inclPct >= 60 ? 'var(--amber)' : 'var(--red)' }}>
            {inclusionMet} / {inclusionTotal}
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${inclPct}%`,
              background: inclPct === 100 ? 'var(--green)' : inclPct >= 60 ? 'var(--amber)' : 'var(--red)',
            }}
          />
        </div>
      </div>

      {/* Exclusion score bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Exclusion</span>
          <span style={{ fontWeight: 600, color: exclPct === 100 ? 'var(--green)' : 'var(--amber)' }}>
            {exclusionMet} / {exclusionTotal}
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${exclPct}%`,
              background: exclPct === 100 ? 'var(--green)' : 'var(--amber)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
