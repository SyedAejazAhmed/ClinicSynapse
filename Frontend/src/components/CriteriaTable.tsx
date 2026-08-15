import { useState } from 'react';
import type { CriterionMatch } from '../types/matching';
import EvidencePanel from './EvidencePanel';

const RESULT_ICON: Record<string, string> = { PASS: '✓', FAIL: '✕', MISSING: '!' };
const RESULT_COLOR: Record<string, string> = {
  PASS: 'var(--green)',
  FAIL: 'var(--red)',
  MISSING: 'var(--amber)',
};

export default function CriteriaTable({ criteria }: { criteria: CriterionMatch[] }) {
  const [selected, setSelected] = useState<CriterionMatch | null>(null);
  const inclusion = criteria.filter(c => c.type === 'inclusion');
  const exclusion = criteria.filter(c => c.type === 'exclusion');

  return (
    <div>
      <div className="section-title" style={{ marginBottom: 8 }}>Criteria</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16 }}>
        {inclusion.length > 0 && (
          <>
            <div style={{ padding: '8px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Inclusion
            </div>
            {inclusion.map(c => <CriterionRow key={c.id} c={c} selected={selected?.id === c.id} onSelect={() => setSelected(selected?.id === c.id ? null : c)} />)}
          </>
        )}
        {exclusion.length > 0 && (
          <>
            <div style={{ padding: '8px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', borderTop: inclusion.length > 0 ? '1px solid var(--border)' : undefined, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Exclusion
            </div>
            {exclusion.map(c => <CriterionRow key={c.id} c={c} selected={selected?.id === c.id} onSelect={() => setSelected(selected?.id === c.id ? null : c)} />)}
          </>
        )}
      </div>
      {selected && <EvidencePanel criterion={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CriterionRow({ c, selected, onSelect }: { c: CriterionMatch; selected: boolean; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr 1fr 36px',
        alignItems: 'center',
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-light)',
        cursor: 'pointer',
        background: selected ? 'var(--accent-light)' : 'var(--surface)',
        transition: 'background 0.1s',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{c.label}</span>
      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{c.patientValue}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.required}</span>
      <span style={{ fontWeight: 700, fontSize: 14, color: RESULT_COLOR[c.result], textAlign: 'center' }}>
        {RESULT_ICON[c.result]}
      </span>
    </div>
  );
}
