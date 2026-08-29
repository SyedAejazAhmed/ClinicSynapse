export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerValue: string | number;
  centerLabel?: string;
  showLegend?: boolean;
}

// Compact SVG donut chart with a dominant center value — used for the
// dashboard trial summary and the trial-page patient status breakdown.
export default function DonutChart({
  segments,
  size = 140,
  strokeWidth = 16,
  centerValue,
  centerLabel,
  showLegend = true,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeFraction = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-light)"
            strokeWidth={strokeWidth}
          />
          {segments.map(seg => {
            const fraction = seg.value / total;
            const dash = fraction * circumference;
            const gap = circumference - dash;
            const offset = -cumulativeFraction * circumference;
            cumulativeFraction += fraction;
            if (seg.value <= 0) return null;
            return (
              <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />
            );
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: size < 110 ? 20 : 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.6px', lineHeight: 1.1 }}>
            {centerValue}
          </div>
          {centerLabel && (
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 2, textAlign: 'center' }}>
              {centerLabel}
            </div>
          )}
        </div>
      </div>

      {showLegend && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {segments.map(seg => (
            <div key={seg.label} className="flex items-center gap-2">
              <span style={{ width: 9, height: 9, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{seg.label}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 'auto' }}>{seg.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
