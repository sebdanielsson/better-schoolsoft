import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.tsx';
import { fetchLessons, type Lesson } from '../api/schoolsoft.ts';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Convert a bitmask of ISO week numbers stored as a 64-bit int to a list of week numbers (1–53). */
function bitmaskToWeeks(bitmask: number): number[] {
  const weeks: number[] = [];
  for (let i = 0; i < 54; i++) {
    if (bitmask & (1 << i)) weeks.push(i + 1);
  }
  return weeks;
}

/** Get the current ISO week number. */
function currentIsoWeek(): number {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const dayOfYear = (now.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1;
  return Math.ceil(dayOfYear / 7);
}

/** Format "1970-01-01 08:20:00.0" → "08:20" */
function formatTime(timeStr: string): string {
  return timeStr.slice(11, 16);
}

/** Map day-of-week from startTime to a day name (lesson times use 1970-01-01 as Monday). */
function lessonDayName(startTime: string): string {
  // SchoolSoft stores startTime as "1970-01-01 HH:MM:SS.0" where the date encodes the weekday.
  // 1970-01-01 is a Thursday (day index 4). Days are offset from that.
  const epochDay = new Date(startTime.replace(' ', 'T').replace('.0', '')).getDay();
  return DAYS[epochDay] ?? 'Unknown';
}

export default function SchedulePage() {
  const { session, getToken } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(currentIsoWeek());

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getToken()
      .then((token) => fetchLessons(session.school, token, session.orgId))
      .then((data) => {
        if (!cancelled) setLessons(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load schedule');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [session, getToken]);

  const lessonsThisWeek = lessons.filter((lesson) => {
    if (!lesson.weeks) return false;
    const weeks = bitmaskToWeeks(lesson.weeks);
    return weeks.includes(selectedWeek);
  });

  const byDay: Record<string, Lesson[]> = {};
  for (const lesson of lessonsThisWeek) {
    const day = lessonDayName(lesson.startTime);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(lesson);
  }

  // Sort each day's lessons by startTime
  const orderedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  for (const day of orderedDays) {
    byDay[day]?.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  const currentWeek = currentIsoWeek();

  if (loading) return <div className="loading">Loading schedule…</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="schedule-page">
      <div className="page-header">
        <h2>Schedule</h2>
        <div className="week-nav">
          <button
            className="btn-icon"
            onClick={() => { setSelectedWeek((w) => Math.max(1, w - 1)); }}
            aria-label="Previous week"
          >
            ‹
          </button>
          <span className="week-label">
            Week {selectedWeek}
            {selectedWeek === currentWeek && <span className="current-badge">current</span>}
          </span>
          <button
            className="btn-icon"
            onClick={() => { setSelectedWeek((w) => Math.min(53, w + 1)); }}
            aria-label="Next week"
          >
            ›
          </button>
        </div>
      </div>

      <div className="schedule-grid">
        {orderedDays.map((day) => (
          <div key={day} className="day-column">
            <div className="day-name">{day}</div>
            {byDay[day]?.length ? (
              byDay[day].map((lesson) => (
                <div key={lesson.id} className="lesson-card">
                  <div className="lesson-time">{formatTime(lesson.startTime)}</div>
                  <div className="lesson-subject">{lesson.groupName ?? `Subject ${lesson.subjectId}`}</div>
                  {lesson.location && <div className="lesson-room">{lesson.location}</div>}
                  {lesson.teacherName && (
                    <div className="lesson-teacher">{lesson.teacherName}</div>
                  )}
                </div>
              ))
            ) : (
              <div className="no-lessons">Free</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
