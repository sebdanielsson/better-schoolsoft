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
    <div
      className="flex items-center justify-center min-h-dvh p-4"
      style={{
        background:
          "radial-gradient(circle at 20% 0%, #e0e7ff 0%, transparent 50%), radial-gradient(circle at 100% 100%, #dbeafe 0%, transparent 50%), #f5f7fb",
      }}
    >
      <div className="bg-white py-10 px-8 rounded-[18px] shadow-[var(--shadow-lg)] w-full max-w-[420px]">
        <h1 className="text-[1.85rem] font-bold mb-1 tracking-[-0.02em]">Signing you in…</h1>
        {error ? (
          <>
            <p className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">
              {error}
            </p>
            <button
              type="button"
              onClick={() => {
                void navigate("/login");
              }}
              className="block w-full py-[0.8rem] px-4 bg-blue-600 text-white border-0 rounded-lg text-base font-semibold cursor-pointer transition-[background] duration-150 hover:bg-blue-700 active:translate-y-px"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <p className="text-slate-500 text-[0.9rem]">
            Exchanging the SchoolSoft code for your session…
          </p>
        )}
      </div>
    </div>
  );
}
