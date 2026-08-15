const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  RECRUITING: { label: 'Recruiting', cls: 'badge-green' },
  COMPLETED: { label: 'Completed', cls: 'badge-gray' },
  SUSPENDED: { label: 'Suspended', cls: 'badge-red' },
  NOT_YET_RECRUITING: { label: 'Not Yet Recruiting', cls: 'badge-amber' },
  ELIGIBLE: { label: 'Eligible', cls: 'badge-green' },
  NEEDS_REVIEW: { label: 'Needs Review', cls: 'badge-amber' },
  INELIGIBLE: { label: 'Ineligible', cls: 'badge-red' },
  Active: { label: 'Active', cls: 'badge-green' },
  Completed: { label: 'Completed', cls: 'badge-gray' },
  Review: { label: 'Review', cls: 'badge-amber' },
  Withdrawn: { label: 'Withdrawn', cls: 'badge-red' },
};

export default function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'badge-gray' };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
