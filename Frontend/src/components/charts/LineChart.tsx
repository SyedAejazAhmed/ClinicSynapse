import { useState } from 'react';

export interface LineSeries {
  name: string;
  color: string;
  values: number[];
}

interface LineChartProps {
  labels: string[];
  series: LineSeries[];
  yUnit?: string;
  height?: number;
}

const VIEW_W = 760;

// Dependency-free responsive line chart with hover tooltip — used by the
// Study Report page's X/Y interactive chart.
export default function LineChart({ labels, series, yUnit = '', height = 280 }: LineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const padding = { top: 16, right: 16, bottom: 34, left: 44 };
  const innerW = VIEW_W - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const allValues = series.flatMap(s => s.values).filter(v => Number.isFinite(v));
  const dataMin = allValues.length ? Math.min(...allValues) : 0;
  const dataMax = allValues.length ? Math.max(...allValues) : 1;
  const pad = (dataMax - dataMin) * 0.15 || 5;
  const yMin = Math.max(0, Math.floor(dataMin - pad));
  const yMax = Math.ceil(dataMax + pad);

  const n = labels.length;
  const xFor = (i: number) => (n <= 1 ? padding.left + innerW / 2 : padding.left + (i / (n - 1)) * innerW);
  const yFor = (v: number) => padding.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const gridLines = 4;
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / gridLines);

  const xLabelStep = Math.max(1, Math.ceil(n / 7));

  if (n === 0 || series.every(s => s.values.length === 0)) {
    return (
      <div className="empty-state" style={{ padding: 32 }}>
        <p>No data available for this selection.</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {series.length > 1 && (
        <div className="flex items-center gap-3" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
          {series.map(s => (
            <div key={s.name} className="flex items-center gap-1">
              <span style={{ width: 10, height: 3, borderRadius: 2, background: s.color, display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        width="100%"
        height={height}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHoverIndex(null)}
      >
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
            <text x={padding.left - 8} y={yFor(gv) + 4} textAnchor="end" fontSize={10.5} fill="var(--text-muted)">
              {Math.round(gv)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {labels.map((label, i) =>
          i % xLabelStep === 0 ? (
            <text key={i} x={xFor(i)} y={height - padding.bottom + 18} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)">
              {label}
            </text>
          ) : null
        )}

        {/* Series lines */}
        {series.map(s => {
          const points = s.values
            .map((v, i) => (Number.isFinite(v) ? `${xFor(i)},${yFor(v)}` : null))
            .filter(Boolean)
            .join(' ');
          return (
            <g key={s.name}>
              <polyline points={points} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) =>
                Number.isFinite(v) ? (
                  <circle
                    key={i}
                    cx={xFor(i)}
                    cy={yFor(v)}
                    r={hoverIndex === i ? 4.5 : 3}
                    fill={s.color}
                    stroke="var(--surface)"
                    strokeWidth={1.5}
                  />
                ) : null
              )}
            </g>
          );
        })}

        {/* Hover target overlay */}
        {labels.map((_, i) => (
          <rect
            key={i}
            x={xFor(i) - innerW / n / 2}
            y={padding.top}
            width={innerW / n}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
          />
        ))}

        {hoverIndex !== null && (
          <line
            x1={xFor(hoverIndex)}
            x2={xFor(hoverIndex)}
            y1={padding.top}
            y2={height - padding.bottom}
            stroke="var(--accent)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.5}
          />
        )}
      </svg>

      {hoverIndex !== null && (
        <div
          style={{
            position: 'absolute',
            left: `${(xFor(hoverIndex) / VIEW_W) * 100}%`,
            top: 4,
            transform: 'translateX(-50%)',
            background: 'var(--text-primary)',
            color: '#fff',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11.5,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: 'var(--shadow-md)',
            zIndex: 5,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{labels[hoverIndex]}</div>
          {series.map(s => (
            <div key={s.name}>
              {s.name}: {Number.isFinite(s.values[hoverIndex]) ? s.values[hoverIndex] : '—'} {yUnit}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
