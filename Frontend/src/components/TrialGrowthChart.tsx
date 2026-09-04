import { useMemo, useState } from 'react';
import { BarChart3, ChevronDown } from 'lucide-react';
import type { Trial } from '../types/trial';
import BarChart from './charts/BarChart';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface TrialGrowthChartProps {
  trials: Trial[];
}

// Cumulative trial-count growth by month, derived entirely from each trial's
// real startDate (no backend changes, no fabricated numbers). A trial counts
// toward a given month once its startDate falls on or before the end of
// that month, so the bars mirror how "Total Trials" has grown over time.
export default function TrialGrowthChart({ trials }: TrialGrowthChartProps) {
  const parsedDates = useMemo(
    () =>
      trials
        .map(t => (t.startDate ? new Date(t.startDate) : null))
        .filter((d): d is Date => !!d && !Number.isNaN(d.getTime())),
    [trials]
  );

  const availableYears = useMemo(() => {
    const years = new Set(parsedDates.map(d => d.getFullYear()));
    const now = new Date().getFullYear();
    years.add(now);
    return Array.from(years).sort((a, b) => b - a);
  }, [parsedDates]);

  const currentYear = new Date().getFullYear();
  const defaultYear = availableYears.includes(currentYear) ? currentYear : availableYears[0];
  const [selectedYear, setSelectedYear] = useState(defaultYear);

  const { labels, values } = useMemo(() => {
    const today = new Date();
    const isCurrentYear = selectedYear === today.getFullYear();
    const lastMonth = isCurrentYear ? today.getMonth() : 11;

    const monthLabels: string[] = [];
    const monthValues: number[] = [];
    for (let m = 0; m <= lastMonth; m++) {
      const endOfMonth = new Date(selectedYear, m + 1, 0, 23, 59, 59);
      const count = parsedDates.filter(d => d.getTime() <= endOfMonth.getTime()).length;
      monthLabels.push(MONTH_LABELS[m]);
      monthValues.push(count);
    }
    return { labels: monthLabels, values: monthValues };
  }, [parsedDates, selectedYear]);

  return (
    <div className="card">
      <div className="flex items-center justify-between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div className="flex items-center gap-2">
          <BarChart3 size={14} style={{ color: 'var(--accent)' }} />
          <span className="section-title" style={{ marginBottom: 0 }}>Trial Growth</span>
        </div>
        <div className="flex items-center gap-1" style={{ position: 'relative' }}>
          <select
            className="select"
            style={{ padding: '5px 26px 5px 10px', fontSize: 11.5, appearance: 'none' }}
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            aria-label="Select year"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>
                {y === currentYear ? 'This Year' : y}
              </option>
            ))}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: 'var(--text-muted)' }} />
        </div>
      </div>

      <BarChart labels={labels} values={values} color="var(--accent)" height={200} />

      <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Trials</span>
      </div>
    </div>
  );
}
