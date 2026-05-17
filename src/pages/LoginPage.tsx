import { type FormEvent, useEffect, useState } from "react";
import { fetchSchoolList, groupSchoolsBySlug, type SchoolOption } from "../api/schoolsoft.ts";
import { buildAuthorizeUrl, generatePkce, savePkce } from "../api/pkce.ts";
import SchoolCombobox from "../components/SchoolCombobox.tsx";

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
      className="flex items-center justify-center min-h-dvh p-4"
      style={{
        background:
          "radial-gradient(circle at 20% 0%, #e0e7ff 0%, transparent 50%), radial-gradient(circle at 100% 100%, #dbeafe 0%, transparent 50%), #f5f7fb",
      }}
    >
      <div className="bg-white py-10 px-8 rounded-[18px] shadow-[var(--shadow-lg)] w-full max-w-[420px]">
        <h1 className="text-[1.85rem] font-bold mb-1 tracking-[-0.02em]">Better SchoolSoft</h1>
        <p className="text-slate-500 mb-7 text-[0.9rem]">A friendlier interface for SchoolSoft</p>

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
            <p className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="block w-full py-[0.8rem] px-4 bg-blue-600 text-white border-0 rounded-lg text-base font-semibold cursor-pointer transition-[background] duration-150 hover:bg-blue-700 active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Sign in with SchoolSoft
          </button>
          <p className="mt-5 text-[0.8rem] text-slate-500 leading-[1.5]">
            We'll redirect you to SchoolSoft's secure sign-in page. After verifying your username,
            password and any 2-factor code, you'll come back here automatically.
          </p>
        </form>
      </div>
    </div>
  );
}
