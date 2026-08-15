import type { MatchResult, MatchStatus } from '../types/matching';
import MatchScore from './MatchScore';

export default function EligibilityCard({ result }: { result: MatchResult }) {
  return (
    <div className="card" style={{ borderLeft: `3px solid ${BORDER_COLOR[result.status]}` }}>
      <div className="section-title">Eligibility Summary</div>
      <MatchScore
        status={result.status}
        inclusionMet={result.inclusionMet}
        inclusionTotal={result.inclusionTotal}
        exclusionMet={result.exclusionMet}
        exclusionTotal={result.exclusionTotal}
      />
    </div>
  );
}

const BORDER_COLOR: Record<MatchStatus, string> = {
  ELIGIBLE:     'var(--green)',
  NEEDS_REVIEW: 'var(--amber)',
  INELIGIBLE:   'var(--red)',
};
