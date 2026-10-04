import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DAY_NAMES_FULL,
  formatLessonTime,
  type EvaLessonTile,
  type Lesson,
  type ScheduleLesson,
} from "../../api/schoolsoft.ts";
import { isoDay, sameLocalDate } from "../../lib/dates.ts";
import { scheduleLessonsForDate } from "../../lib/schedule.ts";
import { activeSchoolDayFor, nextSchoolDay, prevSchoolDay } from "../../lib/school-days.ts";
import { cn } from "../../lib/utils.ts";
import { DashboardCard, Empty, cardLoadingClass } from "./DashboardCard.tsx";

const nowBlockClass = "mb-3 rounded-md bg-blue-600 px-4 py-3.5 text-white";
const nowLabelClass = "text-[0.7rem] font-bold uppercase tracking-[0.08em] opacity-85";
const nowTitleClass = "mt-0.5 text-[1.05rem] font-semibold";
const nowMetaClass = "mt-0.5 text-[0.8rem] opacity-90";
const navButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700";

const lessonRowClass =
  "grid grid-cols-[58px_1fr] items-center gap-3 rounded-md border border-slate-200 bg-white px-2.5 py-2 transition-colors hover:border-slate-300";

/** Combine an Eva lesson tile with the schedule-derived fallback. Eva wins
 *  field-by-field, but missing subject info on its side falls back to the
 *  schedule. If Eva has nothing, return the fallback verbatim. */
function mergeTile(
  eva: EvaLessonTile | null,
  fallback: EvaLessonTile | null,
): EvaLessonTile | null {
  if (!eva) return fallback;
  if (!fallback) return eva;
  return {
    ...eva,
    subjectName: eva.subjectName ?? fallback.subjectName,
    groupName: eva.groupName ?? fallback.groupName,
    teacherName: eva.teacherName ?? fallback.teacherName,
    location: eva.location ?? fallback.location,
    startTime: eva.startTime ?? fallback.startTime,
    endTime: eva.endTime ?? fallback.endTime,
  };
}

function lessonToTile(l: Lesson | null): EvaLessonTile | null {
  if (!l) return null;
  return {
    lessonId: l.id,
    subjectName: l.subjectName ?? l.groupName,
    groupName: l.groupName,
    teacherName: l.teacherName,
    location: l.location,
    startTime: l.startTime,
    endTime: l.endTime,
  };
}

/** The lesson in progress and the next one today, from the schedule. */
function currentAndNext(todayLessons: Lesson[], now: Date) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => {
    const [h, m] = t.slice(11, 16).split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  let current: Lesson | null = null;
  let next: Lesson | null = null;
  for (const l of todayLessons) {
    const s = toMin(l.startTime);
    const e = l.endTime ? toMin(l.endTime) : s + 60;
    if (nowMin >= s && nowMin < e) current = l;
    else if (nowMin < s && !next) next = l;
  }
  return { current, next };
}

/** Day-by-day lessons with a "Now" / "Next up" banner for today. */
export default function ScheduleCard({
  loading,
  scheduleLessons,
  currentTile,
  nextTile,
  today,
}: {
  loading: boolean;
  scheduleLessons: ScheduleLesson[];
  /** Eva's current/next lesson tiles; the schedule fills in what they lack. */
  currentTile: EvaLessonTile | null;
  nextTile: EvaLessonTile | null;
  today: Date;
}) {
  /* Today during school hours, otherwise the next Mon–Fri. The initial day and
   * the target of the "Today" button. */
  const activeSchoolDay = useMemo(() => activeSchoolDayFor(today), [today]);
  const [selectedDay, setSelectedDay] = useState<Date>(activeSchoolDay);

  const lessonsForSelectedDay = useMemo(
    () => scheduleLessonsForDate(scheduleLessons, selectedDay),
    [scheduleLessons, selectedDay],
  );

  /* Prefer the schedule-derived tile whenever the Eva endpoint comes back
   * without a usable subject name (which happens on IES and likely other
   * schools that don't populate Eva's lesson catalog). The Eva tile alone
   * would render "Lesson" — the schedule has the real name (e.g. "Mentor
   * Time"). When both are populated, Eva still wins for its richer fields. */
  const { showCurrent, showNext } = useMemo(() => {
    const todayLessons = isoDay(today) > 5 ? [] : scheduleLessonsForDate(scheduleLessons, today);
    const { current, next } = currentAndNext(todayLessons, today);
    return {
      showCurrent: mergeTile(currentTile, lessonToTile(current)),
      showNext: mergeTile(nextTile, lessonToTile(next)),
    };
  }, [scheduleLessons, today, currentTile, nextTile]);

  const isSelectedToday = sameLocalDate(selectedDay, today);
  const isSelectedActive = sameLocalDate(selectedDay, activeSchoolDay);
  const selectedSubtitle = `${DAY_NAMES_FULL[isoDay(selectedDay)]}, ${selectedDay.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <DashboardCard title="Schedule" linkTo="/schedule" linkLabel="Full schedule →">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-[0.05em] text-slate-500 uppercase">
          {selectedSubtitle}
        </span>
        <div className="flex items-center gap-1">
          {!isSelectedActive && (
            <button
              type="button"
              onClick={() => setSelectedDay(activeSchoolDay)}
              className="mr-1 text-xs font-medium text-slate-500 transition-colors hover:text-blue-600"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedDay((d) => prevSchoolDay(d))}
            className={navButtonClass}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedDay((d) => nextSchoolDay(d))}
            className={navButtonClass}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {loading ? (
        <div className={cardLoadingClass}>Loading…</div>
      ) : (
        <>
          {isSelectedToday && showCurrent && (
            <div className={nowBlockClass}>
              <div className={nowLabelClass}>Now</div>
              <div className={nowTitleClass}>
                {showCurrent.subjectName ?? showCurrent.groupName ?? "Lesson"}
              </div>
              <div className={nowMetaClass}>
                {showCurrent.startTime && formatLessonTime(showCurrent.startTime)}
                {showCurrent.endTime && `–${formatLessonTime(showCurrent.endTime)}`}
                {showCurrent.location && ` · ${showCurrent.location}`}
                {showCurrent.teacherName && ` · ${showCurrent.teacherName}`}
              </div>
            </div>
          )}
          {isSelectedToday && showNext && !showCurrent && (
            <div className={nowBlockClass}>
              <div className={nowLabelClass}>Next up</div>
              <div className={nowTitleClass}>
                {showNext.subjectName ?? showNext.groupName ?? "Lesson"}
              </div>
              <div className={nowMetaClass}>
                {showNext.startTime && formatLessonTime(showNext.startTime)}
                {showNext.endTime && `–${formatLessonTime(showNext.endTime)}`}
                {showNext.location && ` · ${showNext.location}`}
              </div>
            </div>
          )}
          {lessonsForSelectedDay.length > 0 ? (
            <ul className="flex list-none flex-col gap-1.5">
              {lessonsForSelectedDay.map((l) => (
                <LessonRow
                  key={l.id}
                  lesson={l}
                  highlight={isSelectedToday && showCurrent?.lessonId === l.id}
                />
              ))}
            </ul>
          ) : !isSelectedToday || (!showCurrent && !showNext) ? (
            <Empty>No lessons scheduled.</Empty>
          ) : null}
        </>
      )}
    </DashboardCard>
  );
}

function LessonRow({ lesson, highlight }: { lesson: Lesson; highlight?: boolean }) {
  const subject = lesson.groupName ?? lesson.subjectName ?? `Subject ${lesson.subjectId}`;
  if (subject === "Break") {
    /* Half-height row for short between-lesson breaks. */
    return (
      <li className="grid grid-cols-[58px_1fr] items-center gap-3 rounded-md border border-slate-100 bg-slate-50/60 px-2.5 py-1 text-slate-500">
        <div className="text-center text-[0.72rem] leading-[1.1] font-medium tabular-nums">
          {formatLessonTime(lesson.startTime)}
          {lesson.endTime && (
            <>
              <span aria-hidden="true">–</span>
              {formatLessonTime(lesson.endTime)}
            </>
          )}
        </div>
        <div className="text-[0.78rem] italic">Break</div>
      </li>
    );
  }
  return (
    <li className={cn(lessonRowClass, highlight && "!border-blue-600 !bg-blue-50")}>
      <div className="text-center text-[0.8rem] leading-[1.1] font-semibold text-blue-600">
        {formatLessonTime(lesson.startTime)}
        {lesson.endTime && (
          <>
            <br />
            <span className="text-[0.72rem] font-medium text-slate-500">
              {formatLessonTime(lesson.endTime)}
            </span>
          </>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "overflow-hidden text-[0.92rem] font-semibold text-ellipsis whitespace-nowrap",
              lesson.cancelled && "text-slate-400 line-through",
            )}
          >
            {subject}
          </span>
          {lesson.cancelled && (
            <RowBadge className="bg-slate-200 text-slate-700">Cancelled</RowBadge>
          )}
          {lesson.absence === "approved" && (
            <RowBadge className="bg-amber-100 text-amber-800">Absent · excused</RowBadge>
          )}
          {lesson.absence === "unapproved" && (
            <RowBadge className="bg-red-100 text-red-800">Absent</RowBadge>
          )}
        </div>
        <div className="mt-0.5 overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-slate-500">
          {lesson.location}
          {lesson.location && lesson.teacherName && " · "}
          {lesson.teacherName}
        </div>
      </div>
    </li>
  );
}

function RowBadge({ className, children }: { className: string; children: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-px text-[0.68rem] leading-[1.4] font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}
