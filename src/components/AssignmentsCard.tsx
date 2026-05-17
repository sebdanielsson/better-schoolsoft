import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHeroData } from "../hooks/useHeroData.tsx";
import { useSchoolsoftParameters } from "../hooks/useSchoolsoftParameters.tsx";
import {
  bootstrapSchoolsoftSession,
  fetchAssignmentsThisWeek,
  isoWeek,
  isoWeekYear,
  type AssignmentRow,
} from "../api/schoolsoft.ts";
import AnimateHeight from "./AnimateHeight.tsx";
import { Skeleton } from "./ui/skeleton.tsx";
import { cn } from "../lib/utils.ts";

function startOfIsoWeek(d: Date): Date {
  const day = d.getDay() || 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1));
  return monday;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

function formatRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${monday.toLocaleDateString(undefined, opts)} – ${sunday.toLocaleDateString(undefined, opts)}`;
}

const submissionIconClass = "h-4 w-4 shrink-0";

function SubmissionIcon({ status }: { status: string }) {
  if (status === "SUBMITTED" || status === "EXPIRED_SUBMITTED") {
    return <CheckCircle2 className={cn(submissionIconClass, "text-green-600")} aria-label="Submitted" />;
  }
  if (status === "EXPIRED_NOT_SUBMITTED") {
    return <AlertCircle className={cn(submissionIconClass, "text-red-600")} aria-label="Past due, not submitted" />;
  }
  return <FileText className={cn(submissionIconClass, "text-slate-400")} aria-label="Assignment" />;
}

export default function AssignmentsCard() {
  const { session, getEvaToken } = useAuth();
  const { parentUserId, child } = useHeroData();
  const params = useSchoolsoftParameters();

  const [weekMonday, setWeekMonday] = useState<Date>(() => startOfIsoWeek(new Date()));
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const week = useMemo(() => isoWeek(weekMonday), [weekMonday]);
  const year = useMemo(() => isoWeekYear(weekMonday), [weekMonday]);
  const range = useMemo(() => formatRange(weekMonday), [weekMonday]);
  const currentWeekMonday = useMemo(() => startOfIsoWeek(new Date()), []);
  const isCurrentWeek = weekMonday.getTime() === currentWeekMonday.getTime();

  useEffect(() => {
    if (!session || !parentUserId || !child) return;
    let cancelled = false;
    /* Don't reset to loading=true on week change — keep the previous week's
     * rows visible while the refetch is in flight so navigating doesn't
     * flicker through a skeleton state. AnimateHeight smooths the swap. */
    setError(null);

    (async () => {
      try {
        const token = await getEvaToken();
        if (!token) throw new Error("No access token");
        const orgId = child.schools[0]?.orgId ?? session.orgId;
        await bootstrapSchoolsoftSession(
          session.school,
          token,
          parentUserId,
          orgId,
          child.studentId,
        );
        const data = await fetchAssignmentsThisWeek(session.school, week, year);
        if (cancelled) return;
        setRows(data);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load assignments");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, parentUserId, child, week, year]);

  /* Hide entirely on schools without the PS module. `null` means the gate
   * hasn't resolved yet — render nothing rather than flashing the card. */
  if (params && !params.useFunctionPS) return null;
  if (!params) return null;

  return (
    <section className="relative overflow-hidden rounded-[18px] border border-slate-200 border-l-4 border-l-rose-500 bg-gradient-to-b from-rose-50 to-white to-[60px] shadow flex flex-col md:col-span-6">
      <header className="flex items-center justify-between px-5 pt-4 pb-1 gap-3">
        <h3 className="text-base font-bold tracking-[-0.01em]">Assignments</h3>
        <div className="flex items-center gap-1">
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={() => setWeekMonday(currentWeekMonday)}
              className="mr-1 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={() => setWeekMonday((m) => addDays(m, -7))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="text-xs font-semibold tabular-nums text-slate-600 min-w-[3.5rem] text-center">
            w{week}
          </span>
          <button
            type="button"
            onClick={() => setWeekMonday((m) => addDays(m, 7))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="flex-1 px-5 pb-5 pt-2">
        <div className="mb-2.5 text-xs font-semibold uppercase tracking-[0.05em] text-slate-500">
          {range}
        </div>
        <AnimateHeight>
          {error && (
            <div className="text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3 text-sm">
              {error}
            </div>
          )}
          {loading && !rows ? (
            <SkeletonList />
          ) : !rows || rows.length === 0 ? (
            <div className="py-4 text-sm text-slate-500">
              {isCurrentWeek ? "No assignments this week." : "No assignments for this week."}
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    to={`/assignments/${row.id}`}
                    className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-inherit no-underline transition-colors hover:border-slate-300 hover:shadow-sm"
                  >
                    <SubmissionIcon status={row.submissionStatus} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.92rem] font-semibold">
                          {row.title}
                        </span>
                        {!row.read && (
                          <span
                            className="inline-block h-2 w-2 rounded-full bg-blue-600 shrink-0"
                            aria-label="Unread"
                          />
                        )}
                      </div>
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.78rem] text-slate-500">
                        {row.subTitle}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AnimateHeight>
      </div>
    </section>
  );
}

function SkeletonList() {
  return (
    <ul className="flex flex-col gap-1.5" aria-hidden="true">
      {Array.from({ length: 2 }).map((_, i) => (
        <li
          key={i}
          className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5"
        >
          <Skeleton className="h-4 w-4 rounded-sm" />
          <div className="min-w-0">
            <Skeleton className="h-4 w-2/3 rounded-sm" />
            <Skeleton className="h-3 w-3/4 rounded-sm mt-1.5" />
          </div>
        </li>
      ))}
    </ul>
  );
}
