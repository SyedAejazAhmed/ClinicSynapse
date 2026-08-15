import { useNavigate } from 'react-router-dom';
import type { Trial } from '../types/trial';
import StatusBadge from './StatusBadge';
import { MapPin, FlaskConical, Users } from 'lucide-react';

export default function TrialCard({ trial }: { trial: Trial }) {
  const nav = useNavigate();
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
          {trial.ctriId}
        </span>
        <StatusBadge status={trial.status} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.2px' }}>
        {trial.title}
      </div>
      <div className="flex items-center gap-3 text-sm text-muted" style={{ marginBottom: 14 }}>
        <span className="flex items-center gap-2">
          <FlaskConical size={13} />
          {trial.phase}
        </span>
        <span>·</span>
        <span className="flex items-center gap-2">
          <MapPin size={13} />
          {trial.locations.join(', ')}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm" style={{ marginBottom: 16 }}>
        <span style={{ color: 'var(--green)', fontWeight: 500 }}>
          {trial.inclusionCriteria.length} inclusion
        </span>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        <span style={{ color: 'var(--red)', fontWeight: 500 }}>
          {trial.exclusionCriteria.length} exclusion
        </span>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-secondary btn-sm" onClick={() => nav(`/trials/${trial.id}`)}>
          View Trial
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => nav(`/matching?trialId=${trial.id}`)}>
          <Users size={12} /> Find Patients
        </button>
      </div>
    </div>
  );
}
