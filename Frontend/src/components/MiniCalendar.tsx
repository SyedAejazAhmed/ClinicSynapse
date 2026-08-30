import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, CalendarDays } from 'lucide-react';

interface CalendarEvent {
  date: string; // YYYY-MM-DD
  label: string;
}

const STORAGE_KEY = 'cri.dashboard.calendarEvents';
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function loadEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Functional dashboard calendar: browse months, select a date, and pin
// important dates (trial visits, follow-ups, milestones) against it.
export default function MiniCalendar() {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState(toKey(today.getFullYear(), today.getMonth(), today.getDate()));
  const [events, setEvents] = useState<CalendarEvent[]>(loadEvents);
  const [draftLabel, setDraftLabel] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of events) {
      map.set(e.date, [...(map.get(e.date) ?? []), e.label]);
    }
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const selectedEvents = eventsByDate.get(selected) ?? [];
  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  function shiftMonth(delta: number) {
    setCursor(c => {
      const m = c.m + delta;
      const y = c.y + Math.floor(m / 12);
      const normM = ((m % 12) + 12) % 12;
      return { y, m: normM };
    });
  }

  function addEvent() {
    const label = draftLabel.trim();
    if (!label) return;
    setEvents(evs => [...evs, { date: selected, label }]);
    setDraftLabel('');
  }

  function removeEvent(label: string) {
    setEvents(evs => evs.filter(e => !(e.date === selected && e.label === label)));
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div className="flex items-center gap-2">
          <CalendarDays size={15} style={{ color: 'var(--accent)' }} />
          <span className="section-title" style={{ marginBottom: 0 }}>Calendar</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={13} />
          </button>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 96, textAlign: 'center' }}>
            {monthLabel}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', padding: '2px 0' }}>
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 14 }}>
        {grid.map((d, i) => {
          if (d === null) return <div key={i} />;
          const key = toKey(cursor.y, cursor.m, d);
          const hasEvents = eventsByDate.has(key);
          const isSelected = key === selected;
          const isToday = key === todayKey;
          return (
            <button
              key={i}
              onClick={() => setSelected(key)}
              style={{
                position: 'relative',
                aspectRatio: '1',
                border: isToday && !isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                borderRadius: 8,
                background: isSelected ? 'var(--accent)' : 'transparent',
                color: isSelected ? '#fff' : 'var(--text-primary)',
                fontSize: 12,
                fontWeight: isSelected || isToday ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease',
              }}
            >
              {d}
              {hasEvents && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 3,
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: isSelected ? '#fff' : 'var(--amber)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
          {new Date(selected).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>

        {selectedEvents.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {selectedEvents.map(label => (
              <div
                key={label}
                className="flex items-center justify-between"
                style={{ background: 'var(--amber-bg)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: 2 }}
                  onClick={() => removeEvent(label)}
                  aria-label="Remove date"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            className="input"
            placeholder="Add important date (e.g. Patient follow-up)"
            value={draftLabel}
            onChange={e => setDraftLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addEvent(); }}
            style={{ fontSize: 12.5, padding: '7px 10px' }}
          />
          <button className="btn btn-primary btn-sm" onClick={addEvent} aria-label="Add date">
            <Plus size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
