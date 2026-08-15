import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Account } from '../types/account';
import { getAccounts } from '../services/accountApi';

interface AuthState {
  account: Account | null;
  accounts: Account[];
  loading: boolean;
  login: (accountId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// Demo-only identity picker — no password, nothing server-authenticated.
// A real ABDM-style deployment would replace this with a proper auth flow.
const STORAGE_KEY = 'cri.accountId';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAccounts()
      .then(list => {
        setAccounts(list);
        const savedId = localStorage.getItem(STORAGE_KEY);
        const saved = list.find(a => a.id === savedId);
        if (saved) setAccount(saved);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (accountId: string) => {
    const found = accounts.find(a => a.id === accountId);
    if (found) {
      setAccount(found);
      localStorage.setItem(STORAGE_KEY, found.id);
    }
  };

  const logout = () => {
    setAccount(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ account, accounts, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
