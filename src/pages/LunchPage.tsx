import { useCallback, useEffect, useState } from "react";
import { ChevronRight, History } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import {
  fetchLunch,
  fetchEvaLunchWeek,
  evaLunchToWeek,
  isoWeek,
  type LunchWeek,
} from "../api/schoolsoft.ts";
import { cn } from "../lib/utils.ts";

const DAY_KEYS: Array<keyof LunchWeek> = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** Eva returns 5 day rows even when every dish is blank; treat those as empty. */
function lunchWeekHasContent(w: LunchWeek): boolean {
  return DAY_KEYS.some((k) => (w[k] as string).trim());
}

export default function LunchPage() {
  const { session, getToken, getEvaToken } = useAuth();
  const [weeks, setWeeks] = useState<LunchWeek[]>([]);
  const [pastWeeks, setPastWeeks] = useState<LunchWeek[]>([]);
  const [pastLoaded, setPastLoaded] = useState(false);
  const [loadingPast, setLoadingPast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentWeek = isoWeek(new Date());

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load(): Promise<LunchWeek[]> {
      const evaToken = await getEvaToken().catch(() => null);
      if (evaToken) {
        /* Eva returns one week at a time; current + next is the useful window —
         * weeks further out tend to return last year's data because there's no
         * year in the URL and the school hasn't planned that far. */
        const targetWeeks = [currentWeek, currentWeek + 1];
        const results = await Promise.allSettled(
          targetWeeks.map((w) =>
            fetchEvaLunchWeek(session!.school, evaToken, session!.orgId, w).then(evaLunchToWeek),
          ),
        );
        const ok = results
          .filter((r): r is PromiseFulfilledResult<LunchWeek | null> => r.status === "fulfilled")
          .map((r) => r.value)
          .filter((w): w is LunchWeek => w !== null);
        if (ok.length) return ok;
      }
      const token = await getToken();
      return fetchLunch(session!.school, token, session!.orgId);
    }

    load()
      .then((data) => {
        if (!cancelled) setWeeks(data ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load lunch menu");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, getToken, getEvaToken, currentWeek]);

  const loadPrevious = useCallback(async () => {
    if (!session || loadingPast || pastLoaded || currentWeek <= 1) return;
    setLoadingPast(true);
    try {
      const evaToken = await getEvaToken().catch(() => null);
      if (!evaToken) {
        setPastLoaded(true);
        return;
      }
      const targets = Array.from({ length: currentWeek - 1 }, (_, i) => i + 1);
      const results = await Promise.allSettled(
        targets.map((w) =>
          fetchEvaLunchWeek(session.school, evaToken, session.orgId, w).then(evaLunchToWeek),
        ),
      );
      const ok = results
        .filter((r): r is PromiseFulfilledResult<LunchWeek | null> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter((w): w is LunchWeek => w !== null && lunchWeekHasContent(w));
      setPastWeeks(ok);
      setPastLoaded(true);
    } finally {
      setLoadingPast(false);
    }
  }, [session, getEvaToken, currentWeek, loadingPast, pastLoaded]);

  const sortedWeeks = [...pastWeeks, ...weeks].sort((a, b) => a.week - b.week);

  if (loading)
    return (
      <div className="py-16 px-8 text-center text-slate-500 text-[0.95rem]">
        Loading lunch menu…
      </div>
    );
  if (error)
    return (
      <div className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
        {error}
      </div>
    );
  if (!sortedWeeks.length)
    return (
      <div className="py-12 px-8 text-center text-slate-500 bg-white rounded-lg border border-dashed border-slate-200">
        No lunch menus available.
      </div>
    );

  const showPastControl = currentWeek > 1;
  const noPastFound = pastLoaded && pastWeeks.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Lunch menu</h2>
        <span className="text-[0.85rem] text-slate-500">
          {sortedWeeks.length} week{sortedWeeks.length === 1 ? "" : "s"} shown
        </span>
      </div>

      {showPastControl && !pastLoaded && (
        <button
          type="button"
          onClick={loadPrevious}
          disabled={loadingPast}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[0.85rem] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <History aria-hidden="true" className="h-3.5 w-3.5" />
          {loadingPast ? "Loading previous weeks…" : "Show previous weeks"}
        </button>
      )}
      {noPastFound && (
        <div className="mb-4 text-[0.85rem] text-slate-500">No previous weeks available.</div>
      )}

      <div className="flex flex-col gap-4">
        {sortedWeeks.map((week) => (
          <details
            key={week.week}
            className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[var(--shadow-sm)]"
            open={week.week === currentWeek}
          >
            <summary
              className={cn(
                "flex cursor-pointer list-none items-center gap-[0.65rem] bg-white px-5 py-[0.9rem] font-semibold transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden",
                "group-open:border-b group-open:border-slate-200",
              )}
            >
              <ChevronRight
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-150 group-open:rotate-90"
              />
              <span>Week {week.week}</span>
              {week.week === currentWeek && (
                <span className="inline-block ml-2 px-[0.6em] py-[0.15em] bg-blue-600 text-white rounded-full text-[0.7rem] font-semibold align-middle tracking-[0.02em]">
                  current
                </span>
              )}
              {week.dates?.[0] && (
                <span className="ml-auto text-[0.78rem] font-normal text-slate-500">
                  {new Date(week.dates[0]).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  {week.dates[4] &&
                    ` – ${new Date(week.dates[4]).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                </span>
              )}
            </summary>
            <div className="grid grid-cols-1 gap-0 md:grid-cols-5">
              {DAY_KEYS.map((key, i) => {
                const menu = (week[key] as string) || "";
                return (
                  <div
                    key={key as string}
                    className="border-r border-slate-200 px-[1.1rem] py-4 last:border-r-0"
                  >
                    <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.05em] text-slate-500">
                      {DAY_LABELS[i]}
                    </div>
                    <div
                      className={cn(
                        "whitespace-pre-wrap text-[0.9rem] leading-[1.5]",
                        !menu && "text-[0.85rem] italic text-slate-500",
                      )}
                    >
                      {menu || "No menu"}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
