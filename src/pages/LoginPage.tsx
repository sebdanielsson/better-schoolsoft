import { type FormEvent, useEffect, useState } from "react";
import { fetchSchoolList, groupSchoolsBySlug, type SchoolOption } from "../api/schoolsoft.ts";
import { buildAuthorizeUrl, generatePkce, savePkce } from "../api/pkce.ts";
import SchoolCombobox from "../components/SchoolCombobox.tsx";
import { isSchoolSlug } from "../lib/safe-url.ts";

const inputClass =
  "px-[0.9rem] py-[0.7rem] border border-slate-200 rounded-lg text-base bg-white font-[inherit] transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-blue-600 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)]";
const labelClass = "text-[0.8rem] font-semibold text-slate-500 tracking-[0.02em] uppercase";

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
    // The slug is interpolated into the authorize URL's path, so constrain it to the shape
    // SchoolSoft actually uses instead of letting arbitrary input steer the destination.
    if (!isSchoolSlug(schoolSlug)) {
      setError("Pick your school from the list — that identifier isn't valid");
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
    <div
      className="flex min-h-dvh items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(circle at 20% 0%, #e0e7ff 0%, transparent 50%), radial-gradient(circle at 100% 100%, #dbeafe 0%, transparent 50%), #f5f7fb",
      }}
    >
      <div className="w-full max-w-[420px] rounded-[18px] bg-white px-8 py-10 shadow-[var(--shadow-lg)]">
        <h1 className="mb-1 text-[1.85rem] font-bold tracking-[-0.02em]">Better SchoolSoft</h1>
        <p className="mb-7 text-[0.9rem] text-slate-500">A friendlier interface for SchoolSoft</p>

        <form onSubmit={startOauthSignIn} className="flex flex-col gap-3">
          <label htmlFor="oauth-school" className={labelClass}>
            School
          </label>
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

          <label htmlFor="oauth-usertype" className={labelClass}>
            Sign in as
          </label>
          <select
            id="oauth-usertype"
            value={usertypeOauth}
            onChange={(e) => {
              setUsertypeOauth(e.target.value as "parent" | "student" | "staff");
            }}
            className={inputClass}
          >
            <option value="parent">Guardian</option>
            <option value="student">Student</option>
            <option value="staff">Staff</option>
          </select>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="block w-full cursor-pointer rounded-lg border-0 bg-blue-600 px-4 py-[0.8rem] text-base font-semibold text-white transition-[background] duration-150 hover:bg-blue-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sign in with SchoolSoft
          </button>
          <p className="mt-5 text-[0.8rem] leading-[1.5] text-slate-500">
            We'll redirect you to SchoolSoft's secure sign-in page. After verifying your username,
            password and any 2-factor code, you'll come back here automatically.
          </p>
        </form>
      </div>
    </div>
  );
}
