import { type FormEvent, useEffect, useState } from "react";
import { fetchSchoolList, groupSchoolsBySlug, type SchoolOption } from "../api/schoolsoft.ts";
import { buildAuthorizeUrl, generatePkce, savePkce } from "../api/pkce.ts";
import SchoolCombobox from "../components/SchoolCombobox.tsx";

export default function LoginPage() {
  const [school, setSchool] = useState("");
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [usertypeOauth, setUsertypeOauth] = useState<"parent" | "student" | "staff">("parent");
  const [error, setError] = useState<string | null>(null);

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
      </div>
    </div>
  );
}
