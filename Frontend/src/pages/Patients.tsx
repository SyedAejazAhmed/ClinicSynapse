import { useEffect, useState } from 'react';
import { getPatients } from '../services/patientApi';
import type { Patient } from '../types/patient';
import PatientCard from '../components/PatientCard';
import { useAuth } from '../context/AuthContext';
import { Search } from 'lucide-react';
import ErrorState from '../components/ErrorState';

export default function Patients() {
  const { account } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    const doctorId = account?.role === 'DOCTOR' ? account.id : undefined;
    setLoading(true);
    setError(null);
    getPatients(doctorId)
      .then(p => { if (!cancelled) setPatients(p); })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load patients.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [account, refreshKey]);

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    return !q || p.researchId.toLowerCase().includes(q) || p.diagnoses.some(d => d.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="page-title">Patient Explorer</div>
      <div className="page-subtitle">
        {account?.role === 'DOCTOR'
          ? `${patients.length} patients matched to your trials${account.specialty ? ` (${account.specialty})` : ''}`
          : `${patients.length} patients in registry`}
      </div>

      <div className="card card-sm mb-4" style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 30 }}
            placeholder="Search by Research Patient ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /> Loading patients...</div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => setRefreshKey(k => k + 1)} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 10 }}>
          {filtered.map(p => <PatientCard key={p.id} patient={p} />)}
        </div>
      )}
    </div>
  );
}
