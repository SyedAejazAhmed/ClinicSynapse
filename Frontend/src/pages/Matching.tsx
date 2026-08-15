import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPatients } from '../services/patientApi';
import { getTrials } from '../services/trialApi';
import { runMatching } from '../services/matchingApi';
import type { Patient } from '../types/patient';
import type { Trial } from '../types/trial';
import type { MatchResult } from '../types/matching';
import EligibilityCard from '../components/EligibilityCard';
import CriteriaTable from '../components/CriteriaTable';
import { useAuth } from '../context/AuthContext';
import { ArrowDown, Search } from 'lucide-react';

type Step = 'idle' | 'analyzing' | 'done';

export default function Matching() {
  const [params] = useSearchParams();
  const { account } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedTrial, setSelectedTrial] = useState<Trial | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [result, setResult] = useState<MatchResult | null>(null);

  useEffect(() => {
    const doctorId = account?.role === 'DOCTOR' ? account.id : undefined;
    Promise.all([getPatients(), getTrials(doctorId)]).then(([p, t]) => {
      setPatients(p);
      setTrials(t);
      const pid = params.get('patientId');
      const tid = params.get('trialId');
      if (pid) setSelectedPatient(p.find(x => x.id === pid) ?? null);
      if (tid) setSelectedTrial(t.find(x => x.id === tid) ?? null);
    });
  }, [account]);

  const handleSearch = () => {
    const found = patients.find(p => p.researchId.toLowerCase() === patientSearch.toLowerCase());
    if (found) setSelectedPatient(found);
  };

  const handleMatch = async () => {
    if (!selectedPatient || !selectedTrial) return;
    setStep('analyzing');
    setResult(null);
    const r = await runMatching(selectedPatient.id, selectedTrial.id);
    setResult(r);
    setStep('done');
  };

  return (
    <div>
      <div className="page-title">Patient → Trial Matching</div>
      <div className="page-subtitle">Select a patient and trial to run eligibility analysis</div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: selection panel */}
        <div>
          {/* Patient search */}
          <div className="card mb-3" style={{ marginBottom: 14 }}>
            <div className="section-title">Patient</div>
            <div className="flex gap-2 mb-3">
              <input
                className="input"
                placeholder="Research Patient ID..."
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <button className="btn btn-secondary btn-sm" onClick={handleSearch}>
                <Search size={13} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>or select from list</div>
            <div style={{ maxHeight: 160, overflowY: 'auto' }}>
              {patients.map(p => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPatient(p)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: selectedPatient?.id === p.id ? 'var(--accent-light)' : 'transparent',
                    color: selectedPatient?.id === p.id ? 'var(--accent)' : 'var(--text-primary)',
                    fontWeight: selectedPatient?.id === p.id ? 600 : 400,
                    fontSize: 13,
                    marginBottom: 2,
                    transition: 'background 0.1s',
                  }}
                >
                  {p.researchId} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {p.age}y {p.sex}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trial selection */}
          <div className="card mb-3" style={{ marginBottom: 14 }}>
            <div className="section-title">Trial</div>
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {trials.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTrial(t)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: selectedTrial?.id === t.id ? 'var(--accent-light)' : 'transparent',
                    color: selectedTrial?.id === t.id ? 'var(--accent)' : 'var(--text-primary)',
                    fontWeight: selectedTrial?.id === t.id ? 600 : 400,
                    fontSize: 13,
                    marginBottom: 2,
                    transition: 'background 0.1s',
                  }}
                >
                  <div>{t.ctriId}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 400 }}>{t.condition} · {t.phase}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary w-full"
            disabled={!selectedPatient || !selectedTrial || step === 'analyzing'}
            onClick={handleMatch}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {step === 'analyzing' ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Analyzing...</> : 'Run Eligibility Check'}
          </button>
        </div>

        {/* Right: results */}
        <div>
          {step === 'idle' && (
            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius)',
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>⚕</div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Select a patient and trial</div>
              <div style={{ fontSize: 12.5 }}>Eligibility analysis will appear here</div>
            </div>
          )}

          {step === 'analyzing' && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{selectedPatient?.researchId}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Patient</div>
              </div>
              <div style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                <ArrowDown size={20} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{selectedTrial?.ctriId}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{selectedTrial?.condition}</div>
              </div>
              <div style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                <ArrowDown size={20} />
              </div>
              <div className="flex items-center justify-center gap-2" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                <div className="spinner" />
                Analyzing eligibility criteria...
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div>
              {/* Match header */}
              <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{selectedPatient?.researchId}</span>
                <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>→</span>
                <span style={{ fontWeight: 600 }}>{selectedTrial?.ctriId}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{selectedTrial?.condition}</span>
              </div>

              <EligibilityCard result={result} />
              <div style={{ marginTop: 16 }}>
                <CriteriaTable criteria={result.criteria} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
