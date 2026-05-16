import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.tsx";
import { exchangeEvaCode, fetchEvaParent } from "../api/schoolsoft.ts";
import { clearPkce, loadPkce } from "../api/pkce.ts";

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session, setEvaTokens } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const errParam = params.get("error");

    if (errParam) {
      setError(`SchoolSoft rejected the sign-in: ${params.get("error_description") ?? errParam}`);
      return;
    }
    if (!code) {
      setError("No code returned from SchoolSoft.");
      return;
    }
    const stored = loadPkce();
    if (!stored) {
      setError("Lost the PKCE handshake (sessionStorage was cleared). Please try again.");
      return;
    }
    if (stored.state !== state) {
      setError("State mismatch — possible CSRF. Please try signing in again.");
      return;
    }

    void (async () => {
      try {
        const tokens = await exchangeEvaCode(stored.school, code, stored.codeVerifier);
        /* Bootstrap session from the parent record. */
        const parent = await fetchEvaParent(stored.school, tokens.access_token);
        const firstSchool = parent.children[0]?.schools[0];
        if (!firstSchool) throw new Error("No school found on this account");
        clearPkce();

        if (!session) {
          localStorage.setItem(
            "bss_session",
            JSON.stringify({
              school: stored.school,
              appKey: "",
              token: "",
              expiryDate: "1970-01-01 00:00:00.0",
              orgId: firstSchool.orgId,
              orgName: firstSchool.name,
              name: parent.firstName,
              lastName: parent.lastName,
              userId: parent.userId,
              userType:
                stored.usertype === "parent" ? "2" : stored.usertype === "student" ? "1" : "0",
              eva: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: Date.now() + tokens.expires * 1000,
              },
            }),
          );
          window.location.assign("/");
          return;
        }
        setEvaTokens(tokens.refresh_token, tokens.access_token, tokens.expires);
        void navigate("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Token exchange failed");
      }
    })();
  }, [params, navigate, session, setEvaTokens]);

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Signing you in…</h1>
        {error ? (
          <>
            <p className="error-message">{error}</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                void navigate("/login");
              }}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <p className="login-subtitle">Exchanging the SchoolSoft code for your session…</p>
        )}
      </div>
    </div>
  );
}
