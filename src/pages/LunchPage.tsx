import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.tsx";
import {
  fetchLunch,
  fetchEvaLunchWeek,
  evaLunchToWeek,
  isoWeek,
  type LunchWeek,
} from "../api/schoolsoft.ts";

const DAY_KEYS: Array<keyof LunchWeek> = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function LunchPage() {
  const { session, getToken, getEvaToken } = useAuth();
  const [weeks, setWeeks] = useState<LunchWeek[]>([]);
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
        /* Eva endpoint returns one week at a time; fetch current + next 2 in parallel. */
        const targetWeeks = [currentWeek, currentWeek + 1, currentWeek + 2];
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

  const sortedWeeks = [...weeks].sort((a, b) => a.week - b.week);

  if (loading) return <div className="loading">Loading lunch menu…</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!sortedWeeks.length) return <div className="empty-state">No lunch menus available.</div>;

  return (
    <div className="lunch-page">
      <div className="page-header">
        <h2>Lunch menu</h2>
        <span className="page-subtitle">
          {sortedWeeks.length} week{sortedWeeks.length === 1 ? "" : "s"} published
        </span>
      </div>

      <div className="lunch-weeks">
        {sortedWeeks.map((week) => (
          <details key={week.week} className="lunch-week" open={week.week === currentWeek}>
            <summary className="lunch-week-header">
              <span>Week {week.week}</span>
              {week.week === currentWeek && <span className="current-badge">current</span>}
              {week.dates?.[0] && (
                <span className="lunch-week-dates">
                  {new Date(week.dates[0]).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  {week.dates[4] &&
                    ` – ${new Date(week.dates[4]).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                </span>
              )}
            </summary>
            <div className="lunch-days">
              {DAY_KEYS.map((key, i) => {
                const menu = (week[key] as string) || "";
                return (
                  <div
                    key={key as string}
                    className={`lunch-day ${!menu ? "lunch-day--empty" : ""}`}
                  >
                    <div className="lunch-day-name">{DAY_LABELS[i]}</div>
                    <div className="lunch-menu">{menu || "No menu"}</div>
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
