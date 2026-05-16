import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth.tsx";
import {
  fetchLessons,
  fetchEvaLessonsWeek,
  bitmaskToWeeks,
  formatLessonTime,
  isoDay,
  isoWeek,
  lessonDayIndex,
  type EvaLessonTile,
  type Lesson,
} from "../api/schoolsoft.ts";

const ORDERED_DAYS: Array<{ idx: number; label: string }> = [
  { idx: 1, label: "Monday" },
  { idx: 2, label: "Tuesday" },
  { idx: 3, label: "Wednesday" },
  { idx: 4, label: "Thursday" },
  { idx: 5, label: "Friday" },
];

/** Treat a row from any source as a Lesson for display. */
type ScheduleRow = {
  id: string;
  startTime: string;
  endTime?: string;
  subject?: string;
  location?: string;
  teacher?: string;
};

function legacyToRow(l: Lesson): ScheduleRow {
  return {
    id: `legacy-${l.id}`,
    startTime: l.startTime,
    endTime: l.endTime,
    subject: l.groupName ?? l.subjectName ?? `Subject ${l.subjectId}`,
    location: l.location,
    teacher: l.teacherName,
  };
}

function evaToRow(l: EvaLessonTile, idx: number): ScheduleRow {
  return {
    id: `eva-${l.lessonId ?? idx}-${l.startTime ?? ""}`,
    startTime: l.startTime ?? "",
    endTime: l.endTime,
    subject: l.subjectName ?? l.groupName ?? "Lesson",
    location: l.location,
    teacher: l.teacherName,
  };
}

export default function SchedulePage() {
  const { session, getToken, getEvaToken } = useAuth();
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"eva" | "legacy" | "empty">("empty");

  const currentWeek = isoWeek(new Date());
  const todayIdx = isoDay(new Date());
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      /* Try Eva first when an OAuth token is available. */
      const evaToken = await getEvaToken().catch(() => null);
      if (evaToken) {
        try {
          /* We need a studentId for the Eva endpoint — pull it from the parent record we
           * already loaded into the session (Eva sessions populate `name` from parent.firstName
           * but not the studentId). The Eva fetcher accepts the orgId from the session. */
          const studentId = await getStudentId(session!, evaToken);
          if (studentId) {
            const tiles = await fetchEvaLessonsWeek(
              session!.school,
              evaToken,
              session!.orgId,
              studentId,
              selectedWeek,
            );
            if (tiles.length && !cancelled) {
              setRows(tiles.map(evaToRow));
              setSource("eva");
              return;
            }
          }
        } catch {
          /* fall through to legacy */
        }
      }
      /* Legacy bitmask-keyed schedule. */
      try {
        const token = await getToken();
        if (!token) throw new Error("legacy session unavailable");
        const lessons = await fetchLessons(session!.school, token, session!.orgId);
        const filtered = lessons.filter(
          (l) => l.weeks && bitmaskToWeeks(l.weeks).includes(selectedWeek),
        );
        if (!cancelled) {
          setRows(filtered.map(legacyToRow));
          setSource(filtered.length ? "legacy" : "empty");
        }
      } catch {
        /* Don't surface 401/410 from the deprecated legacy endpoint as a user-facing error —
         * the user is signed in, the data source is just gone. */
        if (!cancelled) {
          setRows([]);
          setSource("empty");
        }
      }
    }

    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [session, getToken, getEvaToken, selectedWeek]);

  const byDay = useMemo(() => {
    const map: Record<number, ScheduleRow[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const r of rows) {
      const day = r.startTime ? lessonDayIndex(r.startTime) : 0;
      if (day >= 1 && day <= 5) (map[day] ??= []).push(r);
    }
    for (const k of Object.keys(map)) {
      map[Number(k)]?.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [rows]);

  if (loading) return <div className="loading">Loading schedule…</div>;

  return (
    <div className="schedule-page">
      <div className="page-header">
        <h2>Schedule</h2>
        <div className="week-nav">
          <button
            className="btn-icon"
            onClick={() => {
              setSelectedWeek((w) => Math.max(1, w - 1));
            }}
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
            onClick={() => {
              setSelectedWeek((w) => Math.min(53, w + 1));
            }}
            aria-label="Next week"
          >
            ›
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {source === "empty" ? (
        <div className="empty-state">
          <p>
            <strong>Full schedule not available as JSON.</strong>
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            SchoolSoft's iOS app embeds the schedule as a webview rather than fetching JSON, and no
            equivalent endpoint exists. The current and next lesson tiles on the home page do work —
            those are exposed via Eva.
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            You can{" "}
            <a
              href={`https://sms.schoolsoft.se/${session!.school}/jsp/student/right_student_schedule.jsp`}
              target="_blank"
              rel="noreferrer"
            >
              open the schedule directly in SchoolSoft
            </a>{" "}
            for now.
          </p>
        </div>
      ) : (
        <div className="schedule-grid">
          {ORDERED_DAYS.map(({ idx, label }) => {
            const dayLessons = byDay[idx] ?? [];
            const isToday = selectedWeek === currentWeek && idx === todayIdx;
            return (
              <div key={idx} className={`day-column ${isToday ? "is-today" : ""}`}>
                <div className="day-name">
                  {label}
                  {isToday && <span className="current-badge">today</span>}
                </div>
                {dayLessons.length === 0 ? (
                  <div className="no-lessons">Free</div>
                ) : (
                  dayLessons.map((row) => (
                    <div key={row.id} className="lesson-card">
                      <div className="lesson-time">
                        {formatLessonTime(row.startTime)}
                        {row.endTime && `–${formatLessonTime(row.endTime)}`}
                      </div>
                      <div className="lesson-subject">{row.subject}</div>
                      {row.location && <div className="lesson-room">📍 {row.location}</div>}
                      {row.teacher && <div className="lesson-teacher">👤 {row.teacher}</div>}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Pull the student id from the cached Eva /parent response or refetch if needed. */
async function getStudentId(
  session: { school: string },
  accessToken: string,
): Promise<number | null> {
  /* Cache on window so we don't hit /parent on every week-change. */
  const cache = (globalThis as unknown as { __bss_student?: number | null }).__bss_student;
  if (typeof cache === "number") return cache;

  const { fetchEvaParent } = await import("../api/schoolsoft.ts");
  try {
    const parent = await fetchEvaParent(session.school, accessToken);
    const studentId = parent.children[0]?.studentId ?? null;
    (globalThis as unknown as { __bss_student?: number | null }).__bss_student = studentId;
    return studentId;
  } catch {
    return null;
  }
}
