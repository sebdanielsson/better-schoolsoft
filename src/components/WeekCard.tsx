import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useNow } from "../hooks/useNow.ts";
import { useHeroData } from "../hooks/useHeroData.tsx";
import { useSchoolsoftParameters } from "../hooks/useSchoolsoftParameters.tsx";
import { bootstrapSchoolsoftSession } from "../api/schoolsoft.ts";
import { addDays, formatWeekRange, isoWeek, isoWeekYear, mondayOf } from "../lib/dates.ts";
import AnimateHeight from "./AnimateHeight.tsx";
import { Skeleton } from "./ui/skeleton.tsx";
import { cn } from "../lib/utils.ts";

/** The fields every PS start-page row carries. */
export interface WeekRow {
  id: number;
  title: string;
  subTitle: string;
  read: boolean;
}

export interface WeekCardProps<T extends WeekRow> {
  title: string;
  /** Left border + header gradient, e.g. "border-l-rose-500 from-rose-50". */
  accentClass: string;
  /** Lowercase noun for messages: "assignments", "plannings". */
  noun: string;
  emptyCurrentWeek: string;
  /** Must be stable (a module-level function), it keys the fetch effect. */
  fetchWeek: (school: string, week: number, year: number) => Promise<T[]>;
  rowHref: (row: T) => string;
  rowIcon: (row: T) => ReactNode;
}

/** One week of rows from a PS-module ("subject room") start-page endpoint,
 *  with prev/next/today navigation. Hidden on schools without the module. */
export default function WeekCard<T extends WeekRow>(props: WeekCardProps<T>) {
  const { session, getEvaToken } = useAuth();
  const { parentUserId, child } = useHeroData();
  const params = useSchoolsoftParameters();
  const { fetchWeek, noun } = props;

  const [weekMonday, setWeekMonday] = useState<Date>(() => mondayOf(new Date()));
  /* Rows remember the child and week they were fetched for. While another
   * week of the same child loads, the old rows stay up (no skeleton flicker);
   * if that load fails they must not be passed off as the new week's, and
   * another child's rows are never shown at all. */
  const [data, setData] = useState<{ child: string; key: string; rows: T[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const week = isoWeek(weekMonday);
  const year = isoWeekYear(weekMonday);
  const childKey = child ? `${child.schools[0]?.orgId ?? ""}:${child.studentId}` : "";
  const key = `${childKey}@${year}-${week}`;
  const range = useMemo(() => formatWeekRange(weekMonday), [weekMonday]);
  const now = useNow();
  const currentWeekMonday = useMemo(() => mondayOf(now), [now]);
  const isCurrentWeek = weekMonday.getTime() === currentWeekMonday.getTime();

  useEffect(() => {
    if (!session || !parentUserId || !child) return;
    let cancelled = false;
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
        const rows = await fetchWeek(session.school, week, year);
        if (!cancelled) setData({ child: childKey, key, rows });
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : `Failed to load ${noun}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, parentUserId, child, childKey, key, week, year, fetchWeek, noun]);

  /* Hide entirely on schools without the PS module. `null` means the gate
   * hasn't resolved yet — render nothing rather than flashing the card. */
  if (!params?.useFunctionPS) return null;

  const rows = data && (data.key === key || (data.child === childKey && !error)) ? data.rows : null;

  return (
    <section
      className={cn(
        "relative flex flex-col overflow-hidden rounded-[18px] border border-l-4 border-slate-200 bg-gradient-to-b to-white to-[60px] shadow md:col-span-6",
        props.accentClass,
      )}
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-1">
        <h3 className="text-base font-bold tracking-[-0.01em]">{props.title}</h3>
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
          {/* No rows for this child yet and no error: still loading. */}
          {!rows && !error ? (
            <SkeletonList />
          ) : !rows ? null : rows.length === 0 ? (
            <div className="py-4 text-sm text-slate-500">
              {isCurrentWeek ? props.emptyCurrentWeek : `No ${noun} for this week.`}
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    to={props.rowHref(row)}
                    className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-inherit no-underline transition-colors hover:border-slate-300 hover:shadow-sm"
                  >
                    {props.rowIcon(row)}
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
