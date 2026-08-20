import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, FlaskConical, Users, GitMerge,
  BookOpen, BarChart2, Sparkles, Shield, LogOut,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Trials from './pages/Trials';
import TrialDetails from './pages/TrialDetails';
import TrialPatients from './pages/TrialPatients';
import Patients from './pages/Patients';
import PatientDetails from './pages/PatientDetails';
import Matching from './pages/Matching';
import Studies from './pages/Studies';
import StudyDetails from './pages/StudyDetails';
import ReportsOverview from './pages/ReportsOverview';
import Reports from './pages/Reports';
import ResearchAssistant from './pages/ResearchAssistant';
import Login from './pages/Login';
import { useAuth } from './context/AuthContext';

const ADMIN_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/trials', label: 'Trials', icon: FlaskConical },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/matching', label: 'Matching', icon: GitMerge },
  { to: '/studies', label: 'Studies', icon: BookOpen },
  { to: '/reports', label: 'Reports', icon: BarChart2 },
  { to: '/research', label: 'Research AI', icon: Sparkles },
  { to: '/audit', label: 'Audit', icon: Shield },
];

// A doctor account only sees the trials assigned to them (enforced by the
// backend on /api/trials?doctor_id=...) — Studies/Reports/Audit are
// admin-only overview screens, so they're dropped from this nav entirely.
const DOCTOR_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/trials', label: 'My Trials', icon: FlaskConical },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/matching', label: 'Matching', icon: GitMerge },
  { to: '/research', label: 'Research AI', icon: Sparkles },
];

export default function App() {
  const { account, loading, logout } = useAuth();

  if (loading) {
    return <div className="loading-state"><div className="spinner" /> Loading...</div>;
  }

  if (!account) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const isAdmin = account.role === 'ADMIN';
  const nav = isAdmin ? ADMIN_NAV : DOCTOR_NAV;

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="logo-mark">CR</div>
        <div>
          <div className="app-title">Clinical Research Intelligence</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
            {account.initials}
          </div>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{account.name}</span>
          <span
            style={{
              fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.4px',
              border: '1px solid var(--border)', borderRadius: 20, padding: '1px 7px',
            }}
          >
            {account.role}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={logout} title="Sign out">
            <LogOut size={13} />
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <nav className="sidebar">
          <div className="sidebar-section-label">Navigation</div>
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Main */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trials" element={<Trials />} />
            <Route path="/trials/:id" element={<TrialDetails />} />
            <Route path="/trials/:id/patients" element={<TrialPatients />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientDetails />} />
            <Route path="/matching" element={<Matching />} />
            {isAdmin && <Route path="/studies" element={<Studies />} />}
            {isAdmin && <Route path="/studies/:id" element={<StudyDetails />} />}
            {isAdmin && <Route path="/reports" element={<ReportsOverview />} />}
            {isAdmin && <Route path="/reports/:studyId/:subjectId" element={<Reports />} />}
            <Route path="/research" element={<ResearchAssistant />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
