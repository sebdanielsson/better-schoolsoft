import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Leaf, Utensils } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import {
  DAY_NAMES_FULL,
  evaLunchToWeek,
  fetchEvaLunchWeek,
  fetchLunch,
  isoDay,
  isoWeek,
  type LunchWeek,
} from "../api/schoolsoft.ts";
import { Skeleton } from "./ui/skeleton.tsx";
import { cn } from "../lib/utils.ts";

function startOfIsoWeek(d: Date): Date {
  const day = d.getDay() || 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1));
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return i === -1 ? s : s.slice(0, i);
}

interface LunchEntry {
  dish: string;
  vegetarian: boolean;
}

/** Parse SchoolSoft's per-day lunch text into one entry per meal option.
 *  Input lines look like `Veckans lunch · Kycklingkorvstroganoff med ris` —
 *  we split on the middle dot and use the label half only to flag vegetarian
 *  entries. Lines without a separator are treated as a single dish. */
function parseLunchLines(text: string): LunchEntry[] {
  return text
    .split("\n")
    .map((rawLine) => {
      const line = rawLine.trim();
      if (!line) return null;
      const idx = line.indexOf("·");
      const label = idx >= 0 ? line.slice(0, idx) : "";
      const dish = (idx >= 0 ? line.slice(idx + 1) : line).trim();
      if (!dish) return null;
      return { dish, vegetarian: /vegetar/i.test(label) || /vegetar/i.test(dish) };
    })
    .filter((e): e is LunchEntry => e !== null);
}

/* On Sat/Sun the "active" week shifts to next week (current week is done).
 * The Today button restores this anchor. */
function activeLunchMonday(now: Date): Date {
  const start = startOfIsoWeek(now);
  return isoDay(now) >= 6 ? addDays(start, 7) : start;
}

/** Featured day for highlight + featured-text block when viewing the active
 *  week. Defaults to Monday on weekends; otherwise today's weekday. Returns
 *  null when the viewed week isn't the active one. */
function featuredDayForActiveWeek(now: Date): number {
  return isoDay(now) >= 6 ? 1 : isoDay(now);
}

const cardSubtitleClass = "mb-2.5 text-xs font-semibold uppercase tracking-[0.05em] text-slate-500";
const lunchWeekListClass = "flex list-none flex-col gap-1";
const lunchWeekRowClass =
  "grid grid-cols-[44px_1fr] items-baseline gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2";
const lunchWeekRowTodayClass = "!border-amber-500 !bg-amber-50";
const lunchWeekDayClass = "text-[0.7rem] font-bold uppercase tracking-[0.05em] text-slate-500";
const lunchWeekDayTodayClass = "!text-amber-700";
const lunchWeekMealClass = "min-w-0 break-words text-[0.85rem] leading-[1.35]";

const LUNCH_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;

export default function LunchCard() {
  const { session, getEvaToken, getToken } = useAuth();

  const [weekMonday, setWeekMonday] = useState<Date>(() => activeLunchMonday(new Date()));
  const [lunch, setLunch] = useState<LunchWeek | null>(null);
  const [loading, setLoading] = useState(true);

  const week = useMemo(() => isoWeek(weekMonday), [weekMonday]);
  const activeMonday = useMemo(() => activeLunchMonday(new Date()), []);
  const isActiveWeek = weekMonday.getTime() === activeMonday.getTime();
  const featuredDayIdx = isActiveWeek ? featuredDayForActiveWeek(new Date()) : null;

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const evaToken = await getEvaToken().catch(() => null);
      let data: LunchWeek | null = null;
      if (evaToken) {
        try {
          const days = await fetchEvaLunchWeek(session.school, evaToken, session.orgId, week);
          data = evaLunchToWeek(days);
        } catch {
          /* fall through to legacy */
        }
      }
      if (!data) {
        try {
          const legacyToken = await getToken().catch(() => "");
          if (legacyToken) {
            const weeks = await fetchLunch(session.school, legacyToken, session.orgId);
            data = weeks.find((w) => w.week === week) ?? null;
          }
        } catch {
          /* swallow */
        }
      }
      if (!cancelled) {
        setLunch(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, getToken, week]);

  if (!session) return null;

  const featuredText = featuredDayIdx
    ? ((lunch?.[LUNCH_DAYS[featuredDayIdx - 1] ?? "monday"] as string) ?? "")
    : "";
  const subtitle = isActiveWeek
    ? isoDay(new Date()) >= 6
      ? `Next ${DAY_NAMES_FULL[featuredDayIdx ?? 1]} · Week ${week}`
      : `Today · ${DAY_NAMES_FULL[featuredDayIdx ?? 1]}`
    : `Week ${week}`;
  const emptyText = isActiveWeek
    ? isoDay(new Date()) >= 6
      ? "Next week's menu isn't published yet."
      : "No lunch published for today."
    : "No lunch published for this week.";

  return (
    <section className="relative overflow-hidden rounded-[18px] border border-slate-200 border-l-4 border-l-amber-500 bg-gradient-to-b from-amber-50 to-white to-[60px] shadow flex flex-col md:col-span-6">
      <header className="flex items-center justify-between px-5 pt-4 pb-1 gap-3">
        <h3 className="text-base font-bold tracking-[-0.01em]">Lunch</h3>
        <div className="flex items-center gap-1">
          {!isActiveWeek && (
            <button
              type="button"
              onClick={() => setWeekMonday(activeMonday)}
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
        <div className={cardSubtitleClass}>{subtitle}</div>
        <FeaturedLunch text={featuredText} emptyText={emptyText} loading={loading} />
        <ul className={lunchWeekListClass}>
          {LUNCH_DAYS.map((k, i) => {
            const day = i + 1;
            const text = lunch ? ((lunch[k] as string) || "") : "";
            const isFeatured = featuredDayIdx !== null && day === featuredDayIdx;
            const main = firstLine(text).replace(
              /^Veckans (lunch|vegetariska)\s*[·:-]?\s*/i,
              "",
            );
            return (
              <li
                key={k}
                className={cn(lunchWeekRowClass, isFeatured && lunchWeekRowTodayClass)}
              >
                <span
                  className={cn(lunchWeekDayClass, isFeatured && lunchWeekDayTodayClass)}
                >
                  {DAY_NAMES_FULL[day]?.slice(0, 3)}
                </span>
                <span className={lunchWeekMealClass}>
                  {loading ? <Skeleton className="h-3.5 w-2/3 rounded-sm" /> : main || "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function FeaturedLunch({
  text,
  emptyText,
  loading,
}: {
  text: string;
  emptyText: string;
  loading: boolean;
}) {
  const containerClass =
    "mb-4 rounded-md border border-amber-200 bg-amber-50/60 px-4 py-3";

  if (loading) {
    return (
      <div className={cn(containerClass, "flex flex-col gap-2")} aria-hidden="true">
        <Skeleton className="h-4 w-3/4 rounded-sm" />
        <Skeleton className="h-4 w-2/3 rounded-sm" />
      </div>
    );
  }
  const entries = text ? parseLunchLines(text) : [];
  if (entries.length === 0) {
    return (
      <div className={cn(containerClass, "text-sm italic text-slate-500")}>
        {emptyText}
      </div>
    );
  }
  return (
    <div className={cn(containerClass, "flex flex-col gap-1.5")}>
      {entries.map((entry, i) => (
        <div key={i} className="flex items-start gap-2.5">
          {entry.vegetarian ? (
            <Leaf
              className="h-4 w-4 text-green-600 shrink-0 mt-0.5"
              aria-label="Vegetarian"
            />
          ) : (
            <Utensils
              className="h-4 w-4 text-amber-700 shrink-0 mt-0.5"
              aria-label="Main"
            />
          )}
          <span className="text-[0.92rem] leading-[1.35] text-slate-800 break-words">
            {entry.dish}
          </span>
        </div>
      ))}
    </div>
  );
}
