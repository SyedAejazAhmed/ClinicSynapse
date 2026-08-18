import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Stethoscope } from 'lucide-react';

export default function Login() {
  const { accounts, loading, login } = useAuth();
  const nav = useNavigate();

  const handleSelect = (id: string) => {
    login(id);
    nav('/', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)' }}>
      <div className="card" style={{ width: 400 }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="logo-mark">CR</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Clinical Research Intelligence</div>
        </div>
        <div className="text-sm text-muted" style={{ marginBottom: 20 }}>
          Sign in to continue. Demo accounts — no password required.
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" /> Loading accounts...</div>
        ) : (
          <div className="flex flex-col gap-2">
            {accounts.map(a => (
              <button
                key={a.id}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '10px 12px' }}
                onClick={() => handleSelect(a.id)}
              >
                <span
                  style={{
                    width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)',
                    color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0,
                  }}
                >
                  {a.initials}
                </span>
                <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>{a.name}</span>
                {a.role === 'ADMIN' ? <ShieldCheck size={14} style={{ color: 'var(--accent)' }} /> : <Stethoscope size={14} style={{ color: 'var(--text-muted)' }} />}
                <span
                  style={{
                    marginLeft: 8, fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.4px',
                  }}
                >
                  {a.role}
                </span>
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 18, fontSize: 11.5, color: 'var(--text-muted)' }}>
          Admin sees every trial. A doctor account sees only the trials assigned to them
          and that trial's matched patient data.
        </div>
      </div>
    </div>
  );
}
