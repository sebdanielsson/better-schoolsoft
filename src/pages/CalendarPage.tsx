import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.tsx';
import { fetchCalendar, type CalendarEvent } from '../api/schoolsoft.ts';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-SE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-SE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CalendarPage() {
  const { session, getToken } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getToken()
      .then((token) => fetchCalendar(session.school, token, session.orgId))
      .then((data) => {
        if (!cancelled) setEvents(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load calendar');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [session, getToken]);

  const sorted = [...events].sort((a, b) => a.eventStart - b.eventStart);

  if (loading) return <div className="loading">Loading calendar…</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!sorted.length) return <div className="empty-state">No upcoming events in the next 30 days.</div>;

  return (
    <div className="calendar-page">
      <div className="page-header">
        <h2>Calendar</h2>
        <span className="page-subtitle">Next 30 days</span>
      </div>

      <ul className="event-list">
        {sorted.map((event) => (
          <li key={event.id} className="event-card">
            <div className="event-date">{formatDate(event.eventStart)}</div>
            <div className="event-body">
              <div className="event-title">{event.title}</div>
              <div className="event-meta">
                {formatTime(event.eventStart)}
                {event.eventEnd != null && ` – ${formatTime(event.eventEnd)}`}
                {event.eventTypeInfo && ` · ${event.eventTypeInfo}`}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
