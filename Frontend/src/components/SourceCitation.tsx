import type { SourceCitation as SC } from '../types/research';
import { FileText, ClipboardList } from 'lucide-react';

export default function SourceCitation({ source }: { source: SC }) {
  const Icon = source.type === 'report' ? ClipboardList : FileText;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 12.5,
        color: 'var(--text-secondary)',
      }}
    >
      <Icon size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <span style={{ fontWeight: 500 }}>{source.label}</span>
    </div>
  );
}
