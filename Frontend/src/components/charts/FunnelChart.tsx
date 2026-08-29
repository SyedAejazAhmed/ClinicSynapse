export interface FunnelStage {
  label: string;
  value: number;
  color: string;
}

// Professional trapezoidal funnel — each stage narrows relative to the
// stage before it, used on the Trial page to show the screening pipeline.
export default function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const maxValue = Math.max(1, ...stages.map(s => s.value));
  const barHeight = 40;
  const gap = 10;
  const minWidthPct = 22;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, alignItems: 'stretch' }}>
      {stages.map((stage, i) => {
        const widthPct = Math.max(minWidthPct, (stage.value / maxValue) * 100);
        return (
          <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 108, flexShrink: 0, textAlign: 'right', fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>
              {i + 1}. {stage.label}
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: `${widthPct}%`,
                  minWidth: 64,
                  height: barHeight,
                  background: `linear-gradient(135deg, ${stage.color} 0%, ${stage.color}CC 100%)`,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
                  transition: 'width 0.3s ease',
                }}
              >
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>
                  {stage.value}
                </span>
              </div>
            </div>
            <div style={{ width: 44, flexShrink: 0, fontSize: 11, color: 'var(--text-muted)' }}>
              {i === 0 ? '' : `${Math.round((stage.value / maxValue) * 100)}%`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
