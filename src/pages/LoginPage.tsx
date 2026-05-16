import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.tsx";
import {
  fetchEvaParent,
  fetchSchoolList,
  groupSchoolsBySlug,
  refreshEvaToken,
  type SchoolOption,
} from "../api/schoolsoft.ts";
import { buildAuthorizeUrl, generatePkce, savePkce } from "../api/pkce.ts";
import SchoolCombobox from "../components/SchoolCombobox.tsx";

type AdvancedMode = "credentials" | "token";

export default function LoginPage() {
  const { login, setEvaTokens, session, getEvaToken } = useAuth();
  const navigate = useNavigate();

  const [school, setSchool] = useState("");
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSchoolList()
      .then((entries) => {
        if (cancelled) return;
        setSchoolOptions(groupSchoolsBySlug(entries));
        setSchoolsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSchoolsError("Couldn't load the school list — type your school's slug manually.");
        setSchoolsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [usertypeOauth, setUsertypeOauth] = useState<"parent" | "student" | "staff">("parent");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedMode, setAdvancedMode] = useState<AdvancedMode>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usertype, setUsertype] = useState<"0" | "1" | "2">("2");
  const [refreshTokenInput, setRefreshTokenInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startOauthSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const schoolSlug = school.trim().toLowerCase();
    if (!schoolSlug) {
      setError("Enter your school name first");
      return;
    }
    const pkce = await generatePkce();
    const redirectUri = `${window.location.origin}/oauth/callback`;
    savePkce({
      ...pkce,
      school: schoolSlug,
      usertype: usertypeOauth,
      ts: Date.now(),
    });
    window.location.assign(
      buildAuthorizeUrl({
        school: schoolSlug,
        usertype: usertypeOauth,
        redirectUri,
        pkce,
      }),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(school.trim().toLowerCase(), username.trim(), password, usertype);
      void navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleEvaTokenConnect(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const schoolSlug = school.trim().toLowerCase();
      if (!schoolSlug) throw new Error("Enter your school name first");
      const rt = refreshTokenInput.trim();
      if (!rt) throw new Error("Paste your refresh_token");
      const resp = await refreshEvaToken(schoolSlug, rt);
      const parent = await fetchEvaParent(schoolSlug, resp.access_token);
      const firstSchool = parent.children[0]?.schools[0];
      if (!firstSchool) throw new Error("No school found on this account");

      if (!session) {
        localStorage.setItem(
          "bss_session",
          JSON.stringify({
            school: schoolSlug,
            appKey: "",
            token: "",
            expiryDate: "1970-01-01 00:00:00.0",
            orgId: firstSchool.orgId,
            orgName: firstSchool.name,
            name: parent.firstName,
            lastName: parent.lastName,
            userId: parent.userId,
            userType: "2",
            eva: {
              accessToken: resp.access_token,
              refreshToken: resp.refresh_token || rt,
              expiresAt: Date.now() + resp.expires * 1000,
            },
          }),
        );
        window.location.assign("/");
        return;
      }
      setEvaTokens(resp.refresh_token || rt, resp.access_token, resp.expires);
      await getEvaToken();
      void navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect with that token");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Better SchoolSoft</h1>
        <p className="login-subtitle">A friendlier interface for SchoolSoft</p>

        <form onSubmit={startOauthSignIn} className="login-form">
          <label htmlFor="oauth-school">School</label>
          <SchoolCombobox
            id="oauth-school"
            value={school}
            onChange={setSchool}
            options={schoolOptions}
            loading={schoolsLoading}
            error={schoolsError}
            placeholder="Search by name or slug (e.g. your school)"
            required
          />

          <label htmlFor="oauth-usertype">Sign in as</label>
          <select
            id="oauth-usertype"
            value={usertypeOauth}
            onChange={(e) => {
              setUsertypeOauth(e.target.value as "parent" | "student" | "staff");
            }}
          >
            <option value="parent">Guardian</option>
            <option value="student">Student</option>
            <option value="staff">Staff</option>
          </select>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="btn-primary">
            Sign in with SchoolSoft
          </button>
          <p className="login-hint">
            We'll redirect you to SchoolSoft's secure sign-in page. After verifying your username,
            password and any 2-factor code, you'll come back here automatically.
          </p>
        </form>

        <button
          type="button"
          className="btn-link"
          onClick={() => {
            setShowAdvanced((v) => !v);
            setError(null);
          }}
        >
          {showAdvanced ? "Hide advanced options" : "Advanced options"}
        </button>

        {showAdvanced && (
          <div className="advanced-panel">
            <div className="mode-tabs">
              <button
                type="button"
                className={`mode-tab ${advancedMode === "credentials" ? "is-active" : ""}`}
                onClick={() => {
                  setAdvancedMode("credentials");
                  setError(null);
                }}
              >
                Legacy username & password
              </button>
              <button
                type="button"
                className={`mode-tab ${advancedMode === "token" ? "is-active" : ""}`}
                onClick={() => {
                  setAdvancedMode("token");
                  setError(null);
                }}
              >
                Eva refresh token
              </button>
            </div>

            {advancedMode === "credentials" ? (
              <form onSubmit={handleSubmit} className="login-form">
                <label htmlFor="usertype">Login as</label>
                <select
                  id="usertype"
                  value={usertype}
                  onChange={(e) => {
                    setUsertype(e.target.value as "0" | "1" | "2");
                  }}
                >
                  <option value="2">Guardian</option>
                  <option value="1">Student</option>
                  <option value="0">Staff</option>
                </select>

                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                  }}
                  required
                  autoComplete="username"
                />

                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                  required
                  autoComplete="current-password"
                />

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in (legacy)"}
                </button>
                <p className="login-hint">
                  Uses the older <code>logintype=4</code> endpoint. Most of SchoolSoft's data
                  endpoints have moved to the modern flow and won't be accessible this way.
                </p>
              </form>
            ) : (
              <form onSubmit={handleEvaTokenConnect} className="login-form">
                <label htmlFor="rt">Eva refresh_token</label>
                <input
                  id="rt"
                  type="text"
                  spellCheck={false}
                  placeholder="paste here"
                  value={refreshTokenInput}
                  onChange={(e) => {
                    setRefreshTokenInput(e.target.value);
                  }}
                  required
                />
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Connecting…" : "Connect"}
                </button>
                <p className="login-hint">
                  For developers: paste a refresh_token captured from the SchoolSoft iOS app.
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
