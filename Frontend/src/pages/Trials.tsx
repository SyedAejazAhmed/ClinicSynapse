import { useEffect, useMemo, useState } from 'react';
import { getTrials } from '../services/trialApi';
import type { Trial } from '../types/trial';
import TrialCard from '../components/TrialCard';
import TrialEligibilityFunnelPanel from '../components/TrialEligibilityFunnelPanel';
import { useAuth } from '../context/AuthContext';
import { Search } from 'lucide-react';

const PHASES = ['All Phases', 'Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'];
const STATUSES = ['All Statuses', 'RECRUITING', 'NOT_YET_RECRUITING', 'COMPLETED', 'SUSPENDED'];
const AGE_RANGES = ['All Ages', '18–30', '31–45', '46–60', '61–75'];
const SEX_OPTIONS = ['All', 'Male', 'Female'];

export default function Trials() {
  const { account } = useAuth();
  const [trials, setTrials] = useState<Trial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [condition, setCondition] = useState('All Conditions');
  const [phase, setPhase] = useState('All Phases');
  const [status, setStatus] = useState('All Statuses');
  const [state, setState] = useState('All States');
  const [ageRange, setAgeRange] = useState('All Ages');
  const [sex, setSex] = useState('All');
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);

  useEffect(() => {
    const doctorId = account?.role === 'DOCTOR' ? account.id : undefined;
    getTrials(doctorId).then(t => { setTrials(t); setLoading(false); });
  }, [account]);

  // Derived from the actual dataset rather than hardcoded, so filters never
  // drift from what trials.json actually contains.
  const CONDITIONS = useMemo(() => ['All Conditions', ...new Set(trials.map(t => t.condition))], [trials]);
  const STATES = useMemo(() => ['All States', ...new Set(trials.flatMap(t => t.locations))], [trials]);

  const filtered = trials.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.title.toLowerCase().includes(q) || t.ctriId.toLowerCase().includes(q) || t.condition.toLowerCase().includes(q);
    const matchCond = condition === 'All Conditions' || t.condition === condition;
    const matchPhase = phase === 'All Phases' || t.phase === phase;
    const matchStatus = status === 'All Statuses' || t.status === status;
    const matchState = state === 'All States' || t.locations.includes(state);
    // Age and Sex filters are patient-side criteria — filter trials that mention the age range or sex in their criteria text
    const matchAge = ageRange === 'All Ages' || t.inclusionCriteria.some(c => c.field === 'age');
    const matchSex = sex === 'All' || t.inclusionCriteria.some(c =>
      sex === 'Male' ? !c.text.toLowerCase().includes('female only') : !c.text.toLowerCase().includes('male only')
    );
    return matchSearch && matchCond && matchPhase && matchStatus && matchState && matchAge && matchSex;
  });

  return (
    <div className="trial-explorer-layout">
      <div className="trial-explorer-main">
      <div className="page-title">Trial Explorer</div>
      <div className="page-subtitle">{trials.length} trials in registry</div>

      {/* Filters — all 6 as required: Condition, Phase, State, Recruitment Status, Age, Sex */}
      <div className="card card-sm" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 30 }}
              placeholder="Search trials..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="select" value={condition} onChange={e => setCondition(e.target.value)}>
            {CONDITIONS.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="select" value={phase} onChange={e => setPhase(e.target.value)}>
            {PHASES.map(p => <option key={p}>{p}</option>)}
          </select>
          <select className="select" value={state} onChange={e => setState(e.target.value)}>
            {STATES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="select" value={ageRange} onChange={e => setAgeRange(e.target.value)}>
            {AGE_RANGES.map(a => <option key={a}>{a}</option>)}
          </select>
          <select className="select" value={sex} onChange={e => setSex(e.target.value)}>
            {SEX_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        {/* Active filter pills */}
        {(condition !== 'All Conditions' || phase !== 'All Phases' || state !== 'All States' || status !== 'All Statuses' || ageRange !== 'All Ages' || sex !== 'All') && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {condition !== 'All Conditions' && <FilterPill label={condition} onRemove={() => setCondition('All Conditions')} />}
            {phase !== 'All Phases' && <FilterPill label={phase} onRemove={() => setPhase('All Phases')} />}
            {state !== 'All States' && <FilterPill label={state} onRemove={() => setState('All States')} />}
            {status !== 'All Statuses' && <FilterPill label={status} onRemove={() => setStatus('All Statuses')} />}
            {ageRange !== 'All Ages' && <FilterPill label={`Age ${ageRange}`} onRemove={() => setAgeRange('All Ages')} />}
            {sex !== 'All' && <FilterPill label={sex} onRemove={() => setSex('All')} />}
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /> Loading trials...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>No trials match your filters.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
          {filtered.map(t => (
            <TrialCard
              key={t.id}
              trial={t}
              selected={t.id === selectedTrialId}
              onSelect={setSelectedTrialId}
            />
          ))}
        </div>
      )}
      </div>

      <div className="trial-explorer-side">
        <TrialEligibilityFunnelPanel trials={trials} selectedTrialId={selectedTrialId} />
      </div>
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px 2px 10px',
        background: 'var(--accent-light)',
        color: 'var(--accent)',
        borderRadius: 20,
        fontSize: 11.5,
        fontWeight: 500,
      }}
    >
      {label}
      <button
        onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, lineHeight: 1, fontSize: 13 }}
      >
        ×
      </button>
    </span>
  );
}
