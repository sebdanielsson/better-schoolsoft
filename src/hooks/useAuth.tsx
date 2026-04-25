import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchAppKey,
  fetchToken,
  isTokenExpired,
  type AppKeyResponse,
  type TokenResponse,
} from '../api/schoolsoft.ts';

interface Session {
  school: string;
  appKey: string;
  token: string;
  expiryDate: string;
  orgId: number;
  name: string;
}

interface AuthContextValue {
  session: Session | null;
  isAuthenticated: boolean;
  login: (school: string, username: string, password: string, usertype?: '0' | '1' | '2') => Promise<void>;
  logout: () => void;
  getToken: () => Promise<string>;
}

const STORAGE_KEY = 'bss_session';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  });

  // Persist session to localStorage whenever it changes.
  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  const login = useCallback(
    async (school: string, username: string, password: string, usertype: '0' | '1' | '2' = '2') => {
      const appKeyResp: AppKeyResponse = await fetchAppKey(school, username, password, usertype);
      const tokenResp: TokenResponse = await fetchToken(school, appKeyResp.appKey);
      setSession({
        school,
        appKey: appKeyResp.appKey,
        token: tokenResp.token,
        expiryDate: tokenResp.expiryDate,
        orgId: appKeyResp.orgs[0]?.orgId ?? 0,
        name: appKeyResp.name,
      });
    },
    [],
  );

  const logout = useCallback(() => {
    setSession(null);
  }, []);

  const getToken = useCallback(async (): Promise<string> => {
    if (!session) throw new Error('Not authenticated');
    if (!isTokenExpired(session.expiryDate)) return session.token;
    // Refresh the token using the stored app key.
    const tokenResp: TokenResponse = await fetchToken(session.school, session.appKey);
    setSession((prev) =>
      prev
        ? { ...prev, token: tokenResp.token, expiryDate: tokenResp.expiryDate }
        : prev,
    );
    return tokenResp.token;
  }, [session]);

  const value = useMemo(
    () => ({ session, isAuthenticated: session !== null, login, logout, getToken }),
    [session, login, logout, getToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
