import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.tsx';
import { fetchLunch, type LunchWeek } from '../api/schoolsoft.ts';

/** Get the current ISO week number. */
function currentIsoWeek(): number {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const dayOfYear = (now.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1;
  return Math.ceil(dayOfYear / 7);
}

const DAY_KEYS: Array<keyof LunchWeek> = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function LunchPage() {
  const { session, getToken } = useAuth();
  const [weeks, setWeeks] = useState<LunchWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentWeek = currentIsoWeek();

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getToken()
      .then((token) => fetchLunch(session.school, token, session.orgId))
      .then((data) => {
        if (!cancelled) setWeeks(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load lunch menu');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [session, getToken]);

  const sortedWeeks = [...weeks].sort((a, b) => a.week - b.week);

  if (loading) return <div className="loading">Loading lunch menu…</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!sortedWeeks.length) return <div className="empty-state">No lunch menus available.</div>;

  return (
    <div className="lunch-page">
      <div className="page-header">
        <h2>Lunch Menu</h2>
      </div>

      <div className="lunch-weeks">
        {sortedWeeks.map((week) => (
          <details key={week.week} className="lunch-week" open={week.week === currentWeek}>
            <summary className="lunch-week-header">
              Week {week.week}
              {week.week === currentWeek && <span className="current-badge">current</span>}
            </summary>
            <div className="lunch-days">
              {DAY_KEYS.map((key, i) => {
                const menu = (week[key] as string) || '';
                return (
                  <div key={key as string} className={`lunch-day ${!menu ? 'lunch-day--empty' : ''}`}>
                    <div className="lunch-day-name">{DAY_LABELS[i]}</div>
                    <div className="lunch-menu">{menu || 'No menu'}</div>
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
