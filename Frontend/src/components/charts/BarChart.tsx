interface BarChartProps {
  labels: string[];
  values: number[];
  color?: string;
  height?: number;
}

// Dependency-free responsive vertical bar chart with rounded bars, gridlines,
// and value labels above each bar — used by the dashboard's Trial Growth card.
export default function BarChart({ labels, values, color = 'var(--accent)', height = 200 }: BarChartProps) {
  const VIEW_W = 300;
  const padding = { top: 22, right: 6, bottom: 22, left: 26 };
  const innerW = VIEW_W - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const n = labels.length;
  const dataMax = values.length ? Math.max(...values) : 0;
  const yMax = dataMax <= 0 ? 1 : Math.ceil(dataMax * 1.2 / 5) * 5 || dataMax + 1;

  const gridLines = 4;
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) => Math.round((yMax * i) / gridLines));

  const bandW = n > 0 ? innerW / n : innerW;
  const barW = Math.min(28, bandW * 0.5);

  const yFor = (v: number) => padding.top + innerH - (v / yMax) * innerH;
  const xFor = (i: number) => padding.left + bandW * i + bandW / 2;

  if (n === 0) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <p style={{ fontSize: 12.5 }}>No trial start-date data available yet.</p>
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${height}`} width="100%" height={height} style={{ display: 'block', overflow: 'visible' }}>
      {/* Gridlines + Y labels */}
      {gridValues.map((gv, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            x2={VIEW_W - padding.right}
            y1={yFor(gv)}
            y2={yFor(gv)}
            stroke="var(--border-light)"
            strokeWidth={1}
          />
          <text x={padding.left - 6} y={yFor(gv) + 3.5} textAnchor="end" fontSize={8.5} fill="var(--text-muted)">
            {gv}
          </text>
        </g>
      ))}

      {/* Bars */}
      {values.map((v, i) => {
        const x = xFor(i) - barW / 2;
        const y = yFor(v);
        const h = Math.max(0, innerH - (yFor(v) - padding.top));
        const r = Math.min(5, barW / 2);
        return (
          <g key={i}>
            {v > 0 && (
              <text x={xFor(i)} y={y - 6} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--text-primary)">
                {v}
              </text>
            )}
            <path
              d={
                h <= r
                  ? `M${x},${y + h} L${x},${y + h} L${x + barW},${y + h} L${x + barW},${y + h} Z`
                  : `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${y + h} Z`
              }
              fill={color}
            />
          </g>
        );
      })}

      {/* X labels */}
      {labels.map((label, i) => (
        <text key={i} x={xFor(i)} y={height - padding.bottom + 14} textAnchor="middle" fontSize={8.5} fill="var(--text-muted)">
          {label}
        </text>
      ))}
    </svg>
  );
}
