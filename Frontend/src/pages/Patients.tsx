import { useEffect, useState } from 'react';
import { getPatients } from '../services/patientApi';
import type { Patient } from '../types/patient';
import PatientCard from '../components/PatientCard';
import { Search } from 'lucide-react';

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getPatients().then(p => { setPatients(p); setLoading(false); });
  }, []);

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    return !q || p.researchId.toLowerCase().includes(q) || p.diagnoses.some(d => d.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="page-title">Patient Explorer</div>
      <div className="page-subtitle">{patients.length} patients in registry</div>

      <div className="card card-sm mb-4" style={{ marginBottom: 20, maxWidth: 400 }}>
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
      ) : (
        <div style={{ maxWidth: 480 }}>
          {filtered.map(p => <PatientCard key={p.id} patient={p} />)}
        </div>
      )}
    </div>
  );
}
