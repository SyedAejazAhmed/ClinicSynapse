import { useMemo, useState } from 'react';
import type { Study, DailyReport } from '../types/study';
import LineChart from './charts/LineChart';
import type { LineSeries } from './charts/LineChart';
import { LineChart as LineChartIcon } from 'lucide-react';

type ParamKey = 'bp' | 'sugar' | 'heartRate';

const PARAM_OPTIONS: { key: ParamKey; label: string; unit: string }[] = [
  { key: 'bp', label: 'Average Blood Pressure', unit: 'mmHg' },
  { key: 'sugar', label: 'Average Blood Sugar', unit: 'mg/dL' },
  { key: 'heartRate', label: 'Average Heart Rate', unit: 'bpm' },
];

export const OVERALL_SCOPE = 'Overall Study';

function formatDateLabel(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function averageByDate(values: { date: string; value: number }[]): { date: string; avg: number }[] {
  const map = new Map<string, number[]>();
  for (const v of values) {
    if (!map.has(v.date)) map.set(v.date, []);
    map.get(v.date)!.push(v.value);
  }
  return Array.from(map.entries())
    .map(([date, arr]) => ({ date, avg: Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function reportField(r: DailyReport, key: ParamKey, which: 'systolic' | 'diastolic' | 'main' = 'main'): number {
  if (key === 'bp') return which === 'diastolic' ? r.bpDiastolic : r.bpSystolic;
  if (key === 'sugar') return r.bloodGlucose;
  return r.heartRate;
}

interface StudyReportChartProps {
  study: Study;
  defaultScope?: string;
}

// The interactive Study Report visualization: X-axis scope selector
// (Overall Study default, or a specific patient) and Y-axis clinical
// parameter selector, driving a line chart + a small summary strip.
export default function StudyReportChart({ study, defaultScope = OVERALL_SCOPE }: StudyReportChartProps) {
  const [scopeX, setScopeX] = useState<string>(defaultScope);
  const [paramY, setParamY] = useState<ParamKey>('bp');

  const hasStudyData = study.participants.length > 0 && study.participants.some(p => p.reports.length > 0);

  const chart = useMemo(() => {
    if (scopeX === OVERALL_SCOPE) {
      if (paramY === 'bp') {
        const systolic = averageByDate(study.participants.flatMap(p => p.reports.map(r => ({ date: r.date, value: r.bpSystolic }))));
        const diastolic = averageByDate(study.participants.flatMap(p => p.reports.map(r => ({ date: r.date, value: r.bpDiastolic }))));
        return {
          labels: systolic.map(d => formatDateLabel(d.date)),
          series: [
            { name: 'Avg Systolic', color: 'var(--accent)', values: systolic.map(d => d.avg) },
            { name: 'Avg Diastolic', color: 'var(--pink)', values: diastolic.map(d => d.avg) },
          ] as LineSeries[],
        };
      }
      const key = paramY;
      const values = averageByDate(study.participants.flatMap(p => p.reports.map(r => ({ date: r.date, value: reportField(r, key) }))));
      return {
        labels: values.map(d => formatDateLabel(d.date)),
        series: [{ name: PARAM_OPTIONS.find(o => o.key === key)!.label, color: 'var(--accent)', values: values.map(d => d.avg) }] as LineSeries[],
      };
    }

    // Individual patient scope
    const p = study.participants.find(x => x.researchSubjectId === scopeX);
    if (!p) return { labels: [] as string[], series: [] as LineSeries[] };
    const sortedReports = [...p.reports].sort((a, b) => a.date.localeCompare(b.date));
    const labels = sortedReports.map(r => formatDateLabel(r.date));

    if (paramY === 'bp') {
      return {
        labels,
        series: [
          { name: 'Systolic', color: 'var(--accent)', values: sortedReports.map(r => r.bpSystolic) },
          { name: 'Diastolic', color: 'var(--pink)', values: sortedReports.map(r => r.bpDiastolic) },
        ] as LineSeries[],
      };
    }
    return {
      labels,
      series: [{
        name: paramY === 'sugar' ? 'Blood Sugar' : 'Heart Rate',
        color: 'var(--accent)',
        values: sortedReports.map(r => reportField(r, paramY)),
      }] as LineSeries[],
    };
  }, [study, scopeX, paramY]);

  const paramMeta = PARAM_OPTIONS.find(o => o.key === paramY)!;
  const chartTitle = scopeX === OVERALL_SCOPE
    ? `${paramMeta.label} — Overall Study`
    : `${paramMeta.label.replace('Average ', '')} — ${scopeX}`;

  const latestValues = chart.series.map(s => {
    const vals = s.values.filter(v => Number.isFinite(v));
    return { name: s.name, latest: vals[vals.length - 1], avg: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null };
  });

  if (!hasStudyData) {
    return (
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="empty-state" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            No Active Study
          </div>
          <p style={{ margin: 0 }}>
            There is currently no ongoing clinical trial with available patient study data.
          </p>
          <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-muted)' }}>
            No study data available yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="report-controls-row">
          <div className="report-control">
            <label htmlFor="scope-x">X-axis / Scope</label>
            <select id="scope-x" className="select" value={scopeX} onChange={e => setScopeX(e.target.value)}>
              <option value={OVERALL_SCOPE}>{OVERALL_SCOPE}</option>
              {study.participants.map(p => (
                <option key={p.researchSubjectId} value={p.researchSubjectId}>{p.researchSubjectId}</option>
              ))}
            </select>
          </div>
          <div className="report-control">
            <label htmlFor="param-y">Y-axis / Parameter</label>
            <select id="param-y" className="select" value={paramY} onChange={e => setParamY(e.target.value as ParamKey)}>
              {PARAM_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <LineChartIcon size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{chartTitle}</span>
        </div>
        <LineChart labels={chart.labels} series={chart.series} yUnit={paramMeta.unit} />
      </div>

      {latestValues.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 10 }}>Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${latestValues.length}, 1fr)`, gap: 12 }}>
            {latestValues.map(v => (
              <div key={v.name} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>{v.name}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {v.latest ?? '—'} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>{paramMeta.unit}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg: {v.avg ?? '—'} {paramMeta.unit}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
