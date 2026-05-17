import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth.tsx";
import {
  fetchLessons,
  fetchEvaLessonsWeek,
  fetchEvaParent,
  bitmaskToWeeks,
  formatLessonTime,
  isoDay,
  isoWeek,
  lessonDayIndex,
  type EvaLessonTile,
  type Lesson,
} from "../api/schoolsoft.ts";
import { cn } from "../lib/utils.ts";

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

  if (loading)
    return (
      <div className="py-16 px-8 text-center text-slate-500 text-[0.95rem]">Loading schedule…</div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Schedule</h2>
        <div className="flex items-center gap-2">
          <button
            className="cursor-pointer rounded-md border border-slate-200 bg-transparent px-2.5 py-0.5 text-[1.1rem] text-slate-900 transition-colors hover:border-blue-600 hover:bg-blue-100"
            onClick={() => {
              setSelectedWeek((w) => Math.max(1, w - 1));
            }}
            aria-label="Previous week"
          >
            ‹
          </button>
          <span className="min-w-[7rem] text-center text-[0.95rem] font-semibold">
            Week {selectedWeek}
            {selectedWeek === currentWeek && (
              <span className="inline-block ml-2 px-[0.6em] py-[0.15em] bg-blue-600 text-white rounded-full text-[0.7rem] font-semibold align-middle tracking-[0.02em]">
                current
              </span>
            )}
          </span>
          <button
            className="cursor-pointer rounded-md border border-slate-200 bg-transparent px-2.5 py-0.5 text-[1.1rem] text-slate-900 transition-colors hover:border-blue-600 hover:bg-blue-100"
            onClick={() => {
              setSelectedWeek((w) => Math.min(53, w + 1));
            }}
            aria-label="Next week"
          >
            ›
          </button>
        </div>
      </div>

      {error && (
        <div className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {source === "empty" ? (
        <div className="py-12 px-8 text-center text-slate-500 bg-white rounded-lg border border-dashed border-slate-200">
          <p>
            <strong>Full schedule not available as JSON.</strong>
          </p>
          <p className="mt-3">
            SchoolSoft's iOS app embeds the schedule as a webview rather than fetching JSON, and no
            equivalent endpoint exists. The current and next lesson tiles on the home page do work —
            those are exposed via Eva.
          </p>
          <p className="mt-3">
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
        <div className="grid grid-cols-1 gap-[0.85rem] md:grid-cols-3 lg:grid-cols-5">
          {ORDERED_DAYS.map(({ idx, label }) => {
            const dayLessons = byDay[idx] ?? [];
            const isToday = selectedWeek === currentWeek && idx === todayIdx;
            return (
              <div
                key={idx}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3",
                  isToday && "border-blue-600 shadow-[0_0_0_3px_rgba(37,99,235,0.08)]",
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-between border-b-2 border-blue-600 pb-2 text-[0.8rem] font-bold uppercase tracking-[0.05em] text-slate-500",
                    isToday && "text-blue-600",
                  )}
                >
                  {label}
                  {isToday && (
                    <span className="inline-block ml-2 px-[0.6em] py-[0.15em] bg-blue-600 text-white rounded-full text-[0.7rem] font-semibold align-middle tracking-[0.02em]">
                      today
                    </span>
                  )}
                </div>
                {dayLessons.length === 0 ? (
                  <div className="py-2 text-[0.8rem] italic text-slate-500">Free</div>
                ) : (
                  dayLessons.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-md border border-slate-200 bg-slate-50 px-[0.85rem] py-[0.7rem] transition-all hover:-translate-y-px hover:border-slate-300 hover:shadow-[var(--shadow)]"
                    >
                      <div className="mb-1 text-[0.75rem] font-bold text-blue-600">
                        {formatLessonTime(row.startTime)}
                        {row.endTime && `–${formatLessonTime(row.endTime)}`}
                      </div>
                      <div className="text-[0.92rem] font-semibold leading-tight">
                        {row.subject}
                      </div>
                      {row.location && (
                        <div className="mt-0.5 text-[0.78rem] text-slate-500">
                          📍 {row.location}
                        </div>
                      )}
                      {row.teacher && (
                        <div className="mt-0.5 text-[0.78rem] text-slate-500">👤 {row.teacher}</div>
                      )}
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

  try {
    const parent = await fetchEvaParent(session.school, accessToken);
    const studentId = parent.children[0]?.studentId ?? null;
    (globalThis as unknown as { __bss_student?: number | null }).__bss_student = studentId;
    return studentId;
  } catch {
    return null;
  }
}
