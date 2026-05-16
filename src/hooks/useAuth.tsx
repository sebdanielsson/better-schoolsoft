import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchToken,
  isTokenExpired,
  refreshEvaToken,
  type TokenResponse,
  type UserType,
} from "../api/schoolsoft.ts";

interface EvaSession {
  accessToken: string;
  refreshToken: string;
  /** Absolute epoch-ms when the access token expires. */
  expiresAt: number;
}

interface Session {
  school: string;
  appKey: string;
  token: string;
  expiryDate: string;
  orgId: number;
  orgName?: string;
  name: string;
  /** Parent's last name (Eva). Optional for backwards compatibility. */
  lastName?: string;
  /** Parent's user id from Eva (`parent.userId`). Required for profile endpoints. */
  userId?: number;
  userType: UserType;
  pictureUrl?: string;
  /** Optional modern OAuth token pair — enables the /eva/api/v1/... endpoints. */
  eva?: EvaSession;
}

interface AuthContextValue {
  session: Session | null;
  isAuthenticated: boolean;
  logout: () => void;
  getToken: () => Promise<string>;
  /** Get a fresh Eva access token (auto-refresh), or null if no Eva session. */
  getEvaToken: () => Promise<string | null>;
  /** Save an Eva refresh token (and optional initial access token) into the session. */
  setEvaTokens: (refreshToken: string, accessToken?: string, expiresIn?: number) => void;
  clearEvaTokens: () => void;
}

const STORAGE_KEY = "bss_session";

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

  useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  }, [session]);

  const logout = useCallback(() => {
    setSession(null);
  }, []);

  const getToken = useCallback(async (): Promise<string> => {
    if (!session) throw new Error("Not authenticated");
    if (!isTokenExpired(session.expiryDate)) return session.token;
    const tokenResp: TokenResponse = await fetchToken(session.school, session.appKey);
    setSession((prev) =>
      prev ? { ...prev, token: tokenResp.token, expiryDate: tokenResp.expiryDate } : prev,
    );
    return tokenResp.token;
  }, [session]);

  /* Coalesce concurrent Eva-token refreshes into one network call. */
  const evaRefreshInFlight = useRef<Promise<string> | null>(null);

  const getEvaToken = useCallback(async (): Promise<string | null> => {
    if (!session?.eva) return null;
    const eva = session.eva;
    /* 30s safety margin to avoid sending an about-to-expire token. */
    if (eva.accessToken && eva.expiresAt > Date.now() + 30_000) return eva.accessToken;
    if (evaRefreshInFlight.current) return evaRefreshInFlight.current;
    evaRefreshInFlight.current = refreshEvaToken(session.school, eva.refreshToken)
      .then((resp) => {
        const next: EvaSession = {
          accessToken: resp.access_token,
          refreshToken: resp.refresh_token || eva.refreshToken,
          expiresAt: Date.now() + resp.expires * 1000,
        };
        setSession((prev) => (prev ? { ...prev, eva: next } : prev));
        return resp.access_token;
      })
      .finally(() => {
        evaRefreshInFlight.current = null;
      });
    return evaRefreshInFlight.current;
  }, [session]);

  const setEvaTokens = useCallback(
    (refreshToken: string, accessToken?: string, expiresIn?: number) => {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              eva: {
                accessToken: accessToken ?? "",
                refreshToken,
                expiresAt: accessToken ? Date.now() + (expiresIn ?? 900) * 1000 : 0,
              },
            }
          : prev,
      );
    },
    [],
  );

  const clearEvaTokens = useCallback(() => {
    setSession((prev) => (prev ? { ...prev, eva: undefined } : prev));
  }, []);

  const value = useMemo(
    () => ({
      session,
      isAuthenticated: session !== null,
      logout,
      getToken,
      getEvaToken,
      setEvaTokens,
      clearEvaTokens,
    }),
    [session, logout, getToken, getEvaToken, setEvaTokens, clearEvaTokens],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
