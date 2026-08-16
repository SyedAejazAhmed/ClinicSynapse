import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTrialById } from '../services/trialApi';
import type { Trial } from '../types/trial';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeft, MapPin, Building2, Users } from 'lucide-react';

export default function TrialDetails() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [trial, setTrial] = useState<Trial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) getTrialById(id).then(t => { setTrial(t ?? null); setLoading(false); });
  }, [id]);

  if (loading) return <div className="loading-state"><div className="spinner" /> Loading trial...</div>;
  if (!trial) return <div className="empty-state"><p>Trial not found.</p></div>;

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

      {/* Buttons — centered below both cards */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
        <button className="btn btn-primary" onClick={() => nav(`/matching?trialId=${trial.id}`)}>
          <Users size={13} /> Find Matching Patients
        </button>
        <button className="btn btn-secondary" onClick={() => nav(`/trials/${trial.id}/patients`)}>
          <Users size={13} /> View Tested Patients
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
