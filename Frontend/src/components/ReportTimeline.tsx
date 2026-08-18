import type { DailyReport } from '../types/study';

const FATIGUE_COLOR: Record<string, string> = {
  None: 'var(--green)',
  Mild: 'var(--amber)',
  Moderate: 'var(--red)',
  Severe: 'var(--red)',
};

export default function ReportTimeline({ reports }: { reports: DailyReport[] }) {
  return (
    <div>
      {reports.map((r, i) => {
        const d = new Date(r.date);
        const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return (
          <div key={r.date} style={{ display: 'flex', gap: 16, marginBottom: i < reports.length - 1 ? 0 : 0 }}>
            {/* Timeline spine */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', marginTop: 18, flexShrink: 0 }} />
              {i < reports.length - 1 && (
                <div style={{ width: 1, flex: 1, background: 'var(--border)', minHeight: 24 }} />
              )}
            </div>
            {/* Content */}
            <div style={{ flex: 1, paddingBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, marginTop: 14 }}>
                {label}
              </div>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 16px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px 24px',
                }}
              >
                <ReportRow label="Blood glucose" value={`${r.bloodGlucose} mg/dL`} />
                <ReportRow label="Heart rate" value={`${r.heartRate} bpm`} />
                <ReportRow label="Blood pressure" value={`${r.bpSystolic}/${r.bpDiastolic} mmHg`} />
                <ReportRow
                  label="Fatigue"
                  value={r.fatigue}
                  valueColor={FATIGUE_COLOR[r.fatigue]}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: valueColor ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
