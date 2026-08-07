import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHeroData } from "../hooks/useHeroData.tsx";
import { useSchoolsoftParameters } from "../hooks/useSchoolsoftParameters.tsx";
import {
  bootstrapSchoolsoftSession,
  fetchPlanningsThisWeek,
  isoWeek,
  isoWeekYear,
  type PlanningRow,
} from "../api/schoolsoft.ts";
import AnimateHeight from "./AnimateHeight.tsx";
import { Skeleton } from "./ui/skeleton.tsx";

function startOfIsoWeek(d: Date): Date {
  const day = d.getDay() || 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1));
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

export default function PlanningsCard() {
  const { session, getEvaToken } = useAuth();
  const { parentUserId, child } = useHeroData();
  const params = useSchoolsoftParameters();

  const [weekMonday, setWeekMonday] = useState<Date>(() => startOfIsoWeek(new Date()));
  const [rows, setRows] = useState<PlanningRow[] | null>(null);
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

    void (async () => {
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
        const data = await fetchPlanningsThisWeek(session.school, week, year);
        if (cancelled) return;
        setRows(data);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load plannings");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, parentUserId, child, week, year]);

  if (params && !params.useFunctionPS) return null;
  if (!params) return null;

  return (
    <section className="relative flex flex-col overflow-hidden rounded-[18px] border border-l-4 border-slate-200 border-l-indigo-500 bg-gradient-to-b from-indigo-50 to-white to-[60px] shadow md:col-span-6">
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-1">
        <h3 className="text-base font-bold tracking-[-0.01em]">Plannings</h3>
        <div className="flex items-center gap-1">
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={() => setWeekMonday(currentWeekMonday)}
              className="mr-1 text-xs font-medium text-slate-500 transition-colors hover:text-blue-600"
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
          <span className="min-w-[3.5rem] text-center text-xs font-semibold text-slate-600 tabular-nums">
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
      <div className="flex-1 px-5 pt-2 pb-5">
        <div className="mb-2.5 text-xs font-semibold tracking-[0.05em] text-slate-500 uppercase">
          {range}
        </div>
        <AnimateHeight>
          {error && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          {loading && !rows ? (
            <SkeletonList />
          ) : !rows || rows.length === 0 ? (
            <div className="py-4 text-sm text-slate-500">
              {isCurrentWeek ? "No plannings active this week." : "No plannings for this week."}
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    to={`/plannings/${row.planningId}/${row.id}`}
                    className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-inherit no-underline transition-colors hover:border-slate-300 hover:shadow-sm"
                  >
                    <CalendarRange
                      className="h-4 w-4 shrink-0 text-indigo-500"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="overflow-hidden text-[0.92rem] font-semibold text-ellipsis whitespace-nowrap">
                          {row.title}
                        </span>
                        {!row.read && (
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full bg-blue-600"
                            aria-label="Unread"
                          />
                        )}
                      </div>
                      <div className="overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-slate-500">
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
            <Skeleton className="mt-1.5 h-3 w-3/4 rounded-sm" />
          </div>
        </li>
      ))}
    </ul>
  );
}
