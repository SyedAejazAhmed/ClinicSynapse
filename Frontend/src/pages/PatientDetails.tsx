import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatientById } from '../services/patientApi';
import type { Patient } from '../types/patient';
import { ArrowLeft, FlaskConical } from 'lucide-react';

export default function PatientDetails() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) getPatientById(id).then(p => { setPatient(p ?? null); setLoading(false); });
  }, [id]);

  if (loading) return <div className="loading-state"><div className="spinner" /> Loading patient...</div>;
  if (!patient) return <div className="empty-state"><p>Patient not found.</p></div>;

  const completenessColor = patient.dataCompleteness >= 90 ? 'var(--green)' : patient.dataCompleteness >= 70 ? 'var(--amber)' : 'var(--red)';

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={13} /> Back
      </button>

      <div className="flex items-center justify-between mb-4" style={{ marginBottom: 20 }}>
        <div>
          <div className="page-title">{patient.researchId}</div>
          <div className="page-subtitle" style={{ marginBottom: 0 }}>Patient Profile</div>
        </div>
        <button className="btn btn-primary" onClick={() => nav(`/matching?patientId=${patient.id}`)}>
          Match to Trial
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 14, alignItems: 'start' }}>

        {/* LEFT — Demographics, Completeness, Diagnoses, Medications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="card">
              <div className="section-title">Demographics</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Stat label="Age" value={`${patient.age}`} unit="years" />
                <Stat label="Sex" value={patient.sex} />
              </div>
            </div>
            <div className="card">
              <div className="section-title">Data Completeness</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: completenessColor, letterSpacing: '-1px', marginBottom: 6 }}>
                {patient.dataCompleteness}%
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${patient.dataCompleteness}%`, background: completenessColor }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="card">
              <div className="section-title">Diagnoses</div>
              {patient.diagnoses.map(d => (
                <div key={d} className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5 }}>{d}</span>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="section-title">Medications</div>
              {patient.medications.map(m => (
                <div key={m} className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5 }}>{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Latest Labs */}
        <div className="card" style={{ height: '100%' }}>
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical size={14} style={{ color: 'var(--accent)' }} />
            <div className="section-title" style={{ marginBottom: 0 }}>Latest Labs</div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Value</th>
                <th>Unit</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {patient.labs.map(l => (
                <tr key={l.name}>
                  <td style={{ fontWeight: 500 }}>{l.name}</td>
                  <td style={{ fontWeight: 650 }}>{l.value}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{l.unit}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{new Date(l.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="text-xs text-muted font-semibold" style={{ marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>
        {value} {unit && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
    </div>
  );
}
