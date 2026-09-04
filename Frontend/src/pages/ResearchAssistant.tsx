import { useEffect, useState } from 'react';
import { getStudies } from '../services/studyApi';
import type { Study } from '../types/study';
import ResearchChat from '../components/ResearchChat';
import ErrorState from '../components/ErrorState';

export default function ResearchAssistant() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [selectedStudy, setSelectedStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getStudies()
      .then(s => {
        if (cancelled) return;
        setStudies(s);
        if (s.length > 0) setSelectedStudy(s[0]);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load study context.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <div>
        <div className="page-title">Research Assistant</div>
        <div className="page-subtitle">Ask questions grounded in study data and participant records</div>
        <div className="loading-state"><div className="spinner" /> Loading study context...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-title">Research Assistant</div>
        <div className="page-subtitle">Ask questions grounded in study data and participant records</div>
        <ErrorState message={error} onRetry={() => setRefreshKey(k => k + 1)} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-title">Research Assistant</div>
      <div className="page-subtitle">Ask questions grounded in study data and participant records</div>

      {studies.length > 1 && (
        <div className="card card-sm mb-4" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Study Context</div>
          <div className="flex gap-2">
            {studies.map(s => (
              <button
                key={s.id}
                className={`btn btn-sm ${selectedStudy?.id === s.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedStudy(s)}
              >
                {s.id}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedStudy && (
        <div>
          <div className="card card-sm mb-4" style={{ marginBottom: 16, background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Active Study Context</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>{selectedStudy.id}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>
              {selectedStudy.participants.filter(p => p.status === 'Active').length} active participants ·{' '}
              {selectedStudy.reportsToday} reports today
            </div>
          </div>
          <ResearchChat studyId={selectedStudy.id} />
        </div>
      )}
    </div>
  );
}
