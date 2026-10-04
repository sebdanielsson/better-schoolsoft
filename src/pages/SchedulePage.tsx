import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronLeft, ChevronRight, ClipboardCheck, Star } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useNow } from "../hooks/useNow.ts";
import { useHeroData } from "../hooks/useHeroData.tsx";
import {
  bootstrapSchoolsoftSession,
  fetchCalendarEvents,
  fetchCalendarPsEntities,
  fetchCalendarTimeBookings,
  fetchScheduleLessons,
  formatLessonTime,
  lessonDayIndex,
  type CalendarItem,
  type Lesson,
} from "../api/schoolsoft.ts";
import { cn } from "../lib/utils.ts";
import {
  addDays,
  formatDate,
  formatTime,
  formatWeekRange,
  isoWeek,
  isoWeekYear,
  mondayOf,
  sameLocalDate,
} from "../lib/dates.ts";
import {
  inWeek,
  isLongRunning,
  lastIncludedMs,
  lessonStartMs,
  scheduleLessonToLesson,
  weekItems,
  type WeekItem,
} from "../lib/schedule.ts";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const SHOW_LONG_KEY = "bss_schedule_show_long";

/** Whether to show long-running items (term projects and the like), which
 *  otherwise sit in the week strip every week. Remembered per browser. */
function useShowLongRunning(): [boolean, (show: boolean) => void] {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(SHOW_LONG_KEY) === "1";
    } catch {
      return false;
    }
  });
  const update = (next: boolean) => {
    setShow(next);
    try {
      if (next) localStorage.setItem(SHOW_LONG_KEY, "1");
      else localStorage.removeItem(SHOW_LONG_KEY);
    } catch {
      /* storage unavailable: the choice lasts for this visit */
    }
  };
  return [show, update];
}

const navButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700";

interface WeekData {
  /** Child + week the data was loaded for; nothing else is ever shown. */
  key: string;
  lessons: Lesson[];
  items: CalendarItem[];
}

/** Week view built from the same feeds as SchoolSoft's web calendar
 *  ("Kalender (Ny)"): lessons, plus tests, school events and time bookings. */
export default function SchedulePage() {
  const { session, getEvaToken } = useAuth();
  const { parentUserId, child, loading: heroLoading } = useHeroData();
  const studentId = child?.studentId ?? null;
  const orgId = child?.schools[0]?.orgId ?? session?.orgId ?? null;

  const now = useNow();
  const [monday, setMonday] = useState<Date>(() => mondayOf(new Date()));
  const week = isoWeek(monday);
  const year = isoWeekYear(monday);
  const currentMonday = useMemo(() => mondayOf(now), [now]);
  const isCurrentWeek = monday.getTime() === currentMonday.getTime();
  const key = `${orgId}:${studentId}@${year}-${week}`;

  const [data, setData] = useState<WeekData | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    if (!session || !parentUserId || !studentId || !orgId) return;
    let cancelled = false;
    const school = session.school;

    void (async () => {
      try {
        const token = await getEvaToken();
        if (!token) throw new Error("You are signed out. Sign in again to continue.");
        /* The calendar feeds read the cookie session's child in focus. */
        await bootstrapSchoolsoftSession(school, token, parentUserId, orgId, studentId);
        const [lessons, ...extras] = await Promise.allSettled([
          fetchScheduleLessons(school, week),
          fetchCalendarEvents(school, year, week),
          fetchCalendarTimeBookings(school),
          fetchCalendarPsEntities(school),
        ]);
        if (cancelled) return;
        /* Lessons are the page; the overlays are best-effort. */
        if (lessons.status === "rejected") throw lessons.reason;
        setData({
          key,
          /* The feed takes a bare week number; drop anything it returns for
           * another ISO year rather than show it under this week's dates. */
          lessons: lessons.value
            .filter((l) => l.category === "lesson" && inWeek(l.startDate, week, year))
            .map(scheduleLessonToLesson),
          items: extras.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
        });
      } catch (e: unknown) {
        if (!cancelled) {
          /* Don't keep showing an earlier load of this week as if it were fresh. */
          setData((prev) => (prev?.key === key ? null : prev));
          setError({ key, message: e instanceof Error ? e.message : "Failed to load schedule" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, parentUserId, studentId, orgId, week, year, key]);

  const current = data?.key === key ? data : null;
  /* The hero data finished without a child: its parent request failed, and
   * the load effect above can never start. */
  const noAccount = !heroLoading && (!parentUserId || !studentId);
  const failed = noAccount
    ? "Couldn't load your account details. Reload the page to try again."
    : error?.key === key && !current
      ? error.message
      : null;

  const lessonsByDay = useMemo(() => {
    const map: Record<number, Lesson[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const l of current?.lessons ?? []) {
      const day = lessonDayIndex(l.startTime);
      if (day >= 1 && day <= 5) map[day]!.push(l);
    }
    for (const list of Object.values(map))
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [current]);

  const items = useMemo(() => weekItems(current?.items ?? [], monday), [current, monday]);
  const [showLong, setShowLong] = useShowLongRunning();
  const longCount = items.allWeek.filter(isLongRunning).length;
  const stripItems = showLong ? items.allWeek : items.allWeek.filter((it) => !isLongRunning(it));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Schedule</h2>
          <p className="text-sm text-slate-500">{formatWeekRange(monday)}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={() => setMonday(currentMonday)}
              className="mr-1 text-sm font-medium text-slate-500 transition-colors hover:text-blue-600"
            >
              Today
            </button>
          )}
          <button
            type="button"
            className={navButtonClass}
            onClick={() => setMonday((m) => addDays(m, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-[7rem] text-center text-[0.95rem] font-semibold">
            Week {week}
            {isCurrentWeek && (
              <span className="ml-2 inline-block rounded-full bg-blue-600 px-[0.6em] py-[0.15em] align-middle text-[0.7rem] font-semibold tracking-[0.02em] text-white">
                current
              </span>
            )}
          </span>
          <button
            type="button"
            className={navButtonClass}
            onClick={() => setMonday((m) => addDays(m, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {failed ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {failed}
        </div>
      ) : !current ? (
        <div className="px-8 py-16 text-center text-[0.95rem] text-slate-500">
          Loading schedule…
        </div>
      ) : (
        <>
          {items.allWeek.length > 0 && (
            <section className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[0.75rem] font-bold tracking-[0.05em] text-slate-500 uppercase">
                  This week
                </h3>
                {longCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowLong(!showLong)}
                    aria-pressed={showLong}
                    className="text-xs font-medium text-slate-500 transition-colors hover:text-blue-600"
                  >
                    {showLong ? "Hide long-running" : `Show ${longCount} long-running`}
                  </button>
                )}
              </div>
              {stripItems.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {stripItems.map((it) => (
                    <li key={it.key}>
                      <ItemChip item={it} spanLabel />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[0.8rem] text-slate-500">
                  Only long-running items this week.
                </p>
              )}
            </section>
          )}
          {current.lessons.length === 0 && Object.values(items.byDay).every((l) => !l.length) ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-8 py-12 text-center text-slate-500">
              No lessons this week.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-[0.85rem] md:grid-cols-3 lg:grid-cols-5">
              {DAY_LABELS.map((label, i) => {
                const idx = i + 1;
                const date = addDays(monday, i);
                const isToday = sameLocalDate(date, now);
                const dayLessons = lessonsByDay[idx] ?? [];
                const dayItems = items.byDay[idx] ?? [];
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
                        "flex items-center justify-between border-b-2 border-blue-600 pb-2 text-[0.8rem] font-bold tracking-[0.05em] text-slate-500 uppercase",
                        isToday && "text-blue-600",
                      )}
                    >
                      <span>
                        {label}
                        <span className="ml-1.5 font-semibold tracking-normal normal-case">
                          {formatDate(date.getTime(), { day: "numeric", month: "short" })}
                        </span>
                      </span>
                      {isToday && (
                        <span className="ml-2 inline-block rounded-full bg-blue-600 px-[0.6em] py-[0.15em] align-middle text-[0.7rem] font-semibold tracking-[0.02em] text-white">
                          today
                        </span>
                      )}
                    </div>
                    {/* Overlays and lessons in one chronological list. */}
                    {[
                      ...dayItems.map((it) => ({
                        at: it.start,
                        node: <ItemChip key={it.key} item={it} />,
                      })),
                      ...dayLessons.map((l) => ({
                        at: lessonStartMs(l),
                        node: <LessonCard key={l.id} lesson={l} />,
                      })),
                    ]
                      .sort((a, b) => a.at - b.at)
                      .map((e) => e.node)}
                    {dayLessons.length === 0 && (
                      <div className="py-2 text-[0.8rem] text-slate-500 italic">No lessons</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  const subject = lesson.groupName ?? lesson.subjectName ?? `Subject ${lesson.subjectId}`;
  return (
    <div
      className={cn(
        "rounded-md border border-l-4 border-slate-200 bg-slate-50 px-[0.85rem] py-[0.7rem] transition-all hover:-translate-y-px hover:border-slate-300 hover:shadow-[var(--shadow)]",
        lesson.cancelled && "opacity-60",
      )}
      style={{ borderLeftColor: lesson.color ?? undefined }}
    >
      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[0.75rem] font-bold text-blue-600">
        <span className={cn(lesson.cancelled && "line-through")}>
          {formatLessonTime(lesson.startTime)}
          {lesson.endTime && `–${formatLessonTime(lesson.endTime)}`}
        </span>
        {lesson.cancelled && <Badge className="bg-slate-200 text-slate-700">Cancelled</Badge>}
        {lesson.absence === "approved" && (
          <Badge className="bg-amber-100 text-amber-800">Absent · excused</Badge>
        )}
        {lesson.absence === "unapproved" && (
          <Badge className="bg-red-100 text-red-800">Absent</Badge>
        )}
      </div>
      <div
        className={cn(
          "text-[0.92rem] leading-tight font-semibold",
          lesson.cancelled && "line-through",
        )}
      >
        {subject}
      </div>
      {lesson.location && (
        <div className="mt-0.5 text-[0.78rem] text-slate-500">📍 {lesson.location}</div>
      )}
      {lesson.teacherName && (
        <div className="mt-0.5 text-[0.78rem] text-slate-500">👤 {lesson.teacherName}</div>
      )}
    </div>
  );
}

function Badge({ className, children }: { className: string; children: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px text-[0.68rem] leading-[1.4] font-semibold tracking-normal",
        className,
      )}
    >
      {children}
    </span>
  );
}

const ITEM_STYLE: Record<WeekItem["kind"], { icon: typeof Star; className: string }> = {
  test: { icon: ClipboardCheck, className: "border-rose-200 bg-rose-50 text-rose-900" },
  booking: { icon: CalendarClock, className: "border-sky-200 bg-sky-50 text-sky-900" },
  event: { icon: Star, className: "border-green-200 bg-green-50 text-green-900" },
};

/** A test, booking or school event. Timed ones show their time; the week
 *  strip shows the date span instead. Tests link to their subject. */
function ItemChip({ item, spanLabel }: { item: WeekItem; spanLabel?: boolean }) {
  const { icon: Icon, className } = ITEM_STYLE[item.kind];
  const lastDay = lastIncludedMs(item);
  const when = spanLabel
    ? sameLocalDate(new Date(item.start), new Date(lastDay))
      ? formatDate(item.start)
      : `${formatDate(item.start)} – ${formatDate(lastDay)}`
    : `${formatTime(item.start)}–${formatTime(item.end)}`;
  const body = (
    <>
      <Icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-[0.82rem] leading-tight font-semibold">{item.title}</span>
        <span className="block text-[0.72rem] opacity-80">
          {when}
          {item.detail && ` · ${item.detail}`}
        </span>
      </span>
    </>
  );
  const chipClass = cn(
    "flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-inherit no-underline",
    className,
  );
  if (item.kind === "test" && item.activityId) {
    return (
      <Link to={`/subjects/${item.activityId}`} className={cn(chipClass, "hover:brightness-95")}>
        {body}
      </Link>
    );
  }
  if (item.kind === "booking") {
    return (
      <Link to="/bookings" className={cn(chipClass, "hover:brightness-95")}>
        {body}
      </Link>
    );
  }
  return <div className={chipClass}>{body}</div>;
}
