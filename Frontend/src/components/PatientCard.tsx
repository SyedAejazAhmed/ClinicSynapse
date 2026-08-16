import { useNavigate } from 'react-router-dom';
import type { Patient } from '../types/patient';

export default function PatientCard({ patient }: { patient: Patient }) {
  const nav = useNavigate();
  const hba1c = patient.labs.find(l => l.name === 'HbA1c');
  const egfr = patient.labs.find(l => l.name === 'eGFR');

  return (
    <div
      className="card"
      style={{ cursor: 'pointer' }}
      onClick={() => nav(`/patients/${patient.id}`)}
    >
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontWeight: 650, fontSize: 14 }}>{patient.researchId}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: patient.dataCompleteness >= 90 ? 'var(--green)' : 'var(--amber)',
            background: patient.dataCompleteness >= 90 ? 'var(--green-bg)' : 'var(--amber-bg)',
            padding: '2px 7px',
            borderRadius: 20,
          }}
        >
          {patient.dataCompleteness}% complete
        </span>
      </div>
      <div className="text-sm text-muted mb-2">
        {patient.age}y · {patient.sex}
      </div>
      <div className="flex gap-2 flex-wrap mb-2">
        {patient.diagnoses.map(d => (
          <span key={d} className="badge badge-blue">{d}</span>
        ))}
      </div>
      {(hba1c || egfr) && (
        <div className="flex gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {hba1c && <span>HbA1c <strong>{hba1c.value}{hba1c.unit}</strong></span>}
          {egfr && <span>eGFR <strong>{egfr.value}</strong></span>}
        </div>
      )}
    </div>
  );
}
