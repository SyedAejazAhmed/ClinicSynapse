import type { CriterionMatch } from '../types/matching';
import { X, FileText } from 'lucide-react';

const RESULT_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  PASS: { label: 'PASS', color: 'var(--green)', bg: 'var(--green-bg)' },
  FAIL: { label: 'FAIL', color: 'var(--red)', bg: 'var(--red-bg)' },
  MISSING: { label: 'DATA MISSING', color: 'var(--amber)', bg: 'var(--amber-bg)' },
};

export default function EvidencePanel({ criterion, onClose }: { criterion: CriterionMatch; onClose: () => void }) {
  const res = RESULT_LABEL[criterion.result];
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        background: 'var(--surface)',
        padding: 20,
        boxShadow: 'var(--shadow-md)',
        marginBottom: 16,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontWeight: 650, fontSize: 14 }}>{criterion.label} Requirement</span>
        <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px 6px' }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <div className="text-xs text-muted font-semibold" style={{ marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Required</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{criterion.required}</div>
        </div>
        <div>
          <div className="text-xs text-muted font-semibold" style={{ marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Patient Value</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{criterion.patientValue}</div>
        </div>
      </div>

      {criterion.source && (
        <div style={{ marginBottom: 16 }}>
          <div className="text-xs text-muted font-semibold" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source</div>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            <FileText size={13} />
            <span>{criterion.source}</span>
            {criterion.sourceDate && (
              <span style={{ color: 'var(--text-muted)' }}>· {new Date(criterion.sourceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs text-muted font-semibold" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Result</div>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 12px',
            borderRadius: 4,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.5px',
            background: res.bg,
            color: res.color,
          }}
        >
          {res.label}
        </span>
      </div>
    </div>
  );
}
