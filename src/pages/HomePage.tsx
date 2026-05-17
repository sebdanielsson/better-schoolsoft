import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHeroData } from "../hooks/useHeroData.tsx";
import {
  bootstrapSchoolsoftSession,
  fetchLessons,
  fetchCalendar,
  fetchNotices,
  fetchEvaLunchDay,
  fetchEvaCurrentLesson,
  fetchEvaNextLesson,
  fetchEvaNews,
  fetchEvaNextCalendarEvent,
  fetchScheduleLessons,
  bitmaskToWeeks,
  formatLessonTime,
  isoDay,
  isoWeek,
  lessonDayIndex,
  DAY_NAMES_FULL,
  type CalendarEvent,
  type EvaCalendarEvent,
  type EvaLessonTile,
  type EvaNewsItem,
  type Lesson,
  type ScheduleLesson,
} from "../api/schoolsoft.ts";
import AssignmentsCard from "../components/AssignmentsCard.tsx";
import LunchCard from "../components/LunchCard.tsx";
import PlanningsCard from "../components/PlanningsCard.tsx";
import Avatar from "../components/Avatar.tsx";
import { expandSubjectCode } from "../lib/subject-codes.ts";
import NewsPopover, { type NewsPopoverData } from "../components/NewsPopover.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { cn } from "../lib/utils.ts";

function decodeEntities(s: string): string {
  if (typeof document === "undefined") return s;
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}

/** Preview text: take the first 5 non-empty lines so posts that open with a one-line
 *  greeting (e.g. "Kära vårdnadshavare,") still show meaningful content underneath. */
function previewText(s: string | undefined): string {
  if (!s) return "";
  const decoded = decodeEntities(s).replace(/\r\n/g, "\n").trim();
  if (!decoded) return "";
  const lines = decoded
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 5);
  return lines.join("\n");
}

const NEWS_CATEGORY_COLORS: Record<string, string> = {
  "Student Care": "#16a34a",
  Administration: "#2563eb",
  "Info from Teachers": "#8b5cf6",
  "Career Councellor": "#f59e0b",
  "Academic Coordinator": "#ec4899",
};

function newsCategoryColor(cat: string | undefined): string {
  if (!cat) return "#64748b";
  return NEWS_CATEGORY_COLORS[cat] ?? "#0ea5e9";
}

function formatDate(ms: number, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(ms).toLocaleDateString(
    undefined,
    opts ?? { weekday: "short", month: "short", day: "numeric" },
  );
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function daysUntil(ms: number): number {
  const now = new Date();
  const target = new Date(ms);
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function relativeDay(ms: number): string {
  const diff = daysUntil(ms);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return formatDate(ms);
}

/* ---------- Day-nav helpers for the combined schedule card ---------- */

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameLocalDate(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** The school day a card should land on by default — today during school
 *  hours, otherwise the next Mon–Fri. */
function activeSchoolDayFor(now: Date): Date {
  const idx = isoDay(now);
  if (idx <= 5 && now.getHours() < 17) return startOfDay(now);
  return nextSchoolDayDate(now);
}

/** Next Mon–Fri after the given date (Fri→Mon, Sat→Mon, Sun→Mon). */
function nextSchoolDayDate(d: Date): Date {
  const idx = isoDay(d);
  if (idx >= 5) return addDays(startOfDay(d), 8 - idx);
  return addDays(startOfDay(d), 1);
}

/** Previous Mon–Fri before the given date (Mon→Fri, Sat→Fri, Sun→Fri). */
function prevSchoolDayDate(d: Date): Date {
  const idx = isoDay(d);
  if (idx === 1) return addDays(startOfDay(d), -3);
  if (idx === 6) return addDays(startOfDay(d), -1);
  if (idx === 7) return addDays(startOfDay(d), -2);
  return addDays(startOfDay(d), -1);
}

interface EvaData {
  currentLesson: EvaLessonTile | null;
  nextLesson: EvaLessonTile | null;
  news: EvaNewsItem[];
  nextEvent: EvaCalendarEvent | null;
}

const emptyEva: EvaData = {
  currentLesson: null,
  nextLesson: null,
  news: [],
  nextEvent: null,
};

/* ===== Tailwind class constants (migrated from src/index.css home/dashboard sections) ===== */
const accentClasses: Record<"primary" | "warm" | "cool" | "green" | "purple", string> = {
  primary: "border-l-blue-600 bg-gradient-to-b from-blue-50 to-white to-[60px]",
  warm: "border-l-amber-500 bg-gradient-to-b from-amber-50 to-white to-[60px]",
  cool: "border-l-sky-500 bg-gradient-to-b from-sky-50 to-white to-[60px]",
  green: "border-l-green-600 bg-gradient-to-b from-green-50 to-white to-[60px]",
  purple: "border-l-violet-500 bg-gradient-to-b from-violet-50 to-white to-[60px]",
};

const cardClass =
  "relative overflow-hidden rounded-[18px] border border-slate-200 border-l-4 shadow flex flex-col transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-lg";
const cardHeaderClass = "flex items-baseline justify-between px-5 pt-4 pb-1";
const cardHeaderTitleClass = "text-base font-bold tracking-[-0.01em]";
const cardLinkClass = "text-xs font-medium text-slate-500 transition-colors hover:text-blue-600";
const cardBodyClass = "flex-1 px-5 pb-5 pt-2";
const cardEmptyClass = "py-4 text-sm text-slate-500";
const cardLoadingClass = "py-4 text-sm text-slate-500";

const nowBlockClass = "mb-3 rounded-md bg-blue-600 px-4 py-3.5 text-white";
const nowLabelClass = "text-[0.7rem] font-bold uppercase tracking-[0.08em] opacity-85";
const nowTitleClass = "mt-0.5 text-[1.05rem] font-semibold";
const nowMetaClass = "mt-0.5 text-[0.8rem] opacity-90";

const lessonListClass = "flex list-none flex-col gap-1.5";
const lessonRowClass =
  "grid grid-cols-[58px_1fr] items-center gap-3 rounded-md border border-slate-200 bg-white px-2.5 py-2 transition-colors hover:border-slate-300";
const lessonRowHighlightClass = "!border-blue-600 !bg-blue-50";
const lessonRowTimeClass = "text-center text-[0.8rem] font-semibold leading-[1.1] text-blue-600";
const lessonRowEndClass = "text-[0.72rem] font-medium text-slate-500";
const lessonRowBodyClass = "min-w-0";
const lessonRowSubjectClass =
  "overflow-hidden text-ellipsis whitespace-nowrap text-[0.92rem] font-semibold";
const lessonRowMetaClass =
  "mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[0.78rem] text-slate-500";

const eventListClass = "flex list-none flex-col gap-1.5";
const eventRowClass =
  "grid grid-cols-[90px_1fr] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5";
const eventWhenRelClass = "text-[0.82rem] font-bold leading-[1.1] text-green-600";
const eventWhenTimeClass = "mt-0.5 text-[0.72rem] text-slate-500";
const eventTitleClass = "text-[0.92rem] font-semibold";
const eventMetaClass = "mt-0.5 text-[0.78rem] text-slate-500";

const newsListClass = "flex list-none flex-col gap-2.5";
const newsItemClass =
  "grid grid-cols-[auto_1fr] items-start gap-2.5 rounded-md border border-slate-200 bg-white px-3.5 py-3";
const newsItemSkeletonClass = "pointer-events-none";
const newsItemButtonClass = "min-w-0 cursor-pointer bg-transparent p-0 text-left";
const newsBodyClass = "min-w-0";
const newsMetaRowClass =
  "mb-0.5 flex min-h-[1.1rem] flex-wrap items-center gap-1.5 text-[0.75rem] leading-[1.3] text-slate-500";
const newsAuthorClass = "font-semibold text-slate-900";
const newsCategoryClass =
  "rounded-full px-2 py-px text-[0.7rem] font-semibold leading-[1.4] tracking-[0.01em]";
const newsDateClass = "whitespace-nowrap";
const newsAttachClass = "text-[0.8rem]";
const newsTitleClass = "mb-0.5 min-h-[1.3em] text-[0.95rem] font-semibold leading-[1.3]";
const newsDescClass =
  "min-h-[calc(1.45em*5)] overflow-hidden whitespace-pre-line text-[0.85rem] leading-[1.45] text-slate-500 [-webkit-box-orient:vertical] [-webkit-line-clamp:5] [display:-webkit-box]";
const newsDescSkeletonClass = "flex !flex-col justify-between !block";
const newsSkelBarClass = "h-[0.85em] rounded-[4px] shrink-0";
const newsSkelPillClass = "h-[calc(0.7rem*1.4+0.1rem)] rounded-full shrink-0";

const homePageClass = "flex flex-col gap-6";
const dashGridClass = "grid grid-cols-1 md:grid-cols-12 gap-5 items-start";

export default function HomePage() {
  const { session, getToken, getEvaToken } = useAuth();
  /* Parent userId + child come from the shared hero-data context (loaded once by
   * DashboardPage). This page reuses them for its own Eva fetches instead of
   * re-fetching the parent record. */
  const { parentUserId, child } = useHeroData();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [scheduleLessons, setScheduleLessons] = useState<ScheduleLesson[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [news, setNews] = useState<CalendarEvent[]>([]);
  const [eva, setEva] = useState<EvaData>(emptyEva);
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openNews, setOpenNews] = useState<NewsPopoverData | null>(null);

  const today = useMemo(() => new Date(), []);
  const todayWeek = isoWeek(today);
  const todayDayIdx = isoDay(today);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setNewsLoading(true);
    setError(null);

    async function loadEva(accessToken: string): Promise<EvaData> {
      /* The hero-data provider fetched the parent + child already; pull the ids we
       * need from context instead of refetching. */
      if (!parentUserId) return emptyEva;
      const studentId = child?.studentId;
      const orgId = child?.schools[0]?.orgId ?? session!.orgId;

      const week = isoWeek(new Date());
      /* For tile data we always want today's lessons/lunch; the iOS app clamps day to 1-5. */
      const dayForTiles = Math.min(Math.max(todayDayIdx, 1), 5);

      /* News lands independently so the tile can swap from skeleton → list as soon as it
       * resolves, without waiting on the slower combined-tile bundle below. */
      if (studentId) {
        fetchEvaNews(session!.school, accessToken, parentUserId, orgId, studentId)
          .then((list) => {
            if (cancelled) return;
            setEva((prev) => ({ ...prev, news: list ?? [] }));
          })
          .catch(() => {
            /* swallow — fallback to legacy news handles the empty case */
          })
          .finally(() => {
            if (!cancelled) setNewsLoading(false);
          });
      } else if (!cancelled) {
        setNewsLoading(false);
      }

      const tileResults = await Promise.allSettled([
        studentId
          ? fetchEvaCurrentLesson(session!.school, accessToken, orgId, studentId, week, dayForTiles)
          : Promise.resolve(null),
        studentId
          ? fetchEvaNextLesson(session!.school, accessToken, orgId, studentId, week, dayForTiles)
          : Promise.resolve(null),
        studentId
          ? fetchEvaNextCalendarEvent(session!.school, accessToken, parentUserId, orgId, studentId)
          : Promise.resolve(null),
      ]);
      const [cur, nxt, nev] = tileResults.map((r) =>
        r.status === "fulfilled" ? r.value : null,
      ) as [EvaLessonTile | null, EvaLessonTile | null, EvaCalendarEvent | null];
      return {
        currentLesson: cur,
        nextLesson: nxt,
        news: [],
        nextEvent: nev,
      };
    }

    async function loadLegacyLists(legacyToken: string) {
      const [lessonsResp, eventsResp, newsResp] = await Promise.allSettled([
        fetchLessons(session!.school, legacyToken, session!.orgId),
        fetchCalendar(session!.school, legacyToken, session!.orgId, 30),
        fetchNotices(session!.school, legacyToken, session!.orgId, "news,schoolnews", 14, 14),
      ]);
      if (!cancelled) {
        if (lessonsResp.status === "fulfilled") setLessons(lessonsResp.value ?? []);
        if (eventsResp.status === "fulfilled") setEvents(eventsResp.value ?? []);
        if (newsResp.status === "fulfilled") setNews(newsResp.value ?? []);
      }
    }

    async function loadAll() {
      const evaToken = await getEvaToken().catch(() => null);
      const legacyToken = await getToken().catch(() => "");

      if (!evaToken && !cancelled) setNewsLoading(false);

      const evaDataP = evaToken
        ? loadEva(evaToken).catch(() => emptyEva)
        : Promise.resolve(emptyEva);
      const lists = legacyToken ? loadLegacyLists(legacyToken) : Promise.resolve();

      const evaData = await evaDataP;
      if (cancelled) return;
      /* News arrives via its own parallel fetch — preserve whatever's already there
       * so the slower bundle doesn't clobber the news we already painted. */
      setEva((prev) => ({ ...evaData, news: prev.news.length ? prev.news : evaData.news }));
      await lists;
    }

    loadAll()
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, getToken, getEvaToken, todayDayIdx, parentUserId, child]);

  /* Fetch this + next week from the rest-api schedule endpoint. This is what
   * IES Uppsala (and likely other schools) actually populate; the legacy
   * /api/lessons/student/... endpoint returns empty for those tenants. */
  useEffect(() => {
    if (!session || !parentUserId || !child) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getEvaToken();
        if (!token) return;
        const orgId = child.schools[0]?.orgId ?? session.orgId;
        await bootstrapSchoolsoftSession(
          session.school,
          token,
          parentUserId,
          orgId,
          child.studentId,
        );
        const week = isoWeek(new Date());
        const [thisWeek, nextWeek] = await Promise.all([
          fetchScheduleLessons(session.school, week).catch(() => [] as ScheduleLesson[]),
          fetchScheduleLessons(session.school, week + 1).catch(() => [] as ScheduleLesson[]),
        ]);
        if (cancelled) return;
        setScheduleLessons([...thisWeek, ...nextWeek]);
      } catch {
        /* swallow — legacy lessons remain as fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, parentUserId, child]);

  /* The "active" school day — today if it's a weekday before 17:00,
   * otherwise the next Mon–Fri. Used as the initial value for the day toggle
   * and as the target for the "Today" reset button. */
  const activeSchoolDay = useMemo(() => activeSchoolDayFor(today), [today]);

  const [selectedDay, setSelectedDay] = useState<Date>(activeSchoolDay);

  /* Lessons for whichever day the user is viewing — prefer the rest-api
   * schedule, fall back to the legacy week-bitmask list. */
  const lessonsForSelectedDay = useMemo(() => {
    const fromSchedule = scheduleLessonsForDate(scheduleLessons, selectedDay);
    if (fromSchedule.length > 0) return fromSchedule;
    const wk = isoWeek(selectedDay);
    const dayIdx = isoDay(selectedDay);
    if (dayIdx > 5) return [];
    return lessons
      .filter((l) => l.weeks && bitmaskToWeeks(l.weeks).includes(wk))
      .filter((l) => lessonDayIndex(l.startTime) === dayIdx)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [lessons, scheduleLessons, selectedDay]);

  /* Today's lessons feed the "Now / Next up" tile fallback even when the user
   * has navigated away to another day — the tile only renders for today, but
   * the computation depends on the actual current time vs today's schedule. */
  const todayLessons = useMemo(() => {
    if (todayDayIdx > 5) return [];
    const fromSchedule = scheduleLessonsForDate(scheduleLessons, today);
    if (fromSchedule.length > 0) return fromSchedule;
    return lessons
      .filter((l) => l.weeks && bitmaskToWeeks(l.weeks).includes(todayWeek))
      .filter((l) => lessonDayIndex(l.startTime) === todayDayIdx)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [lessons, scheduleLessons, today, todayWeek, todayDayIdx]);

  const isSelectedToday = sameLocalDate(selectedDay, today);
  const isSelectedActive = sameLocalDate(selectedDay, activeSchoolDay);
  const selectedSubtitle = `${DAY_NAMES_FULL[isoDay(selectedDay)]}, ${selectedDay.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  /* Find the current / next lesson today from the legacy list (used as fallback when Eva tile is empty). */
  const { fallbackCurrent, fallbackNext } = useMemo(() => {
    if (!todayLessons.length) return { fallbackCurrent: null, fallbackNext: null };
    const nowMin = today.getHours() * 60 + today.getMinutes();
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
    return { fallbackCurrent: current, fallbackNext: next };
  }, [todayLessons, today]);

  /* Next 5 upcoming events from legacy calendar list. */
  const upcoming = useMemo(
    () => [...events].sort((a, b) => a.eventStart - b.eventStart).slice(0, 5),
    [events],
  );

  const latestLegacyNews = useMemo(
    () => [...news].sort((a, b) => b.eventStart - a.eventStart).slice(0, 3),
    [news],
  );

  if (!session) return null;

  const evaCurrent = eva.currentLesson ?? null;
  const evaNext = eva.nextLesson ?? null;
  /* Prefer the schedule-derived tile whenever the Eva endpoint comes back
   * without a usable subject name (which happens on IES and likely other
   * schools that don't populate Eva's lesson catalog). The Eva tile alone
   * would render "Lesson" — the schedule has the real name (e.g. "Mentor
   * Time"). When both are populated, Eva still wins for its richer fields. */
  const showCurrent: EvaLessonTile | null = mergeTile(evaCurrent, legacyToTile(fallbackCurrent));
  const showNext: EvaLessonTile | null = mergeTile(evaNext, legacyToTile(fallbackNext));

  return (
    <div className={homePageClass}>
      {error && (
        <div className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <div className={dashGridClass}>
        {/* Combined schedule card — toggle between days with prev/next */}
        <section className={cn(cardClass, accentClasses.primary, "md:col-span-6")}>
          <header className={cardHeaderClass}>
            <h3 className={cardHeaderTitleClass}>Schedule</h3>
            <Link className={cardLinkClass} to="/schedule">
              Full schedule →
            </Link>
          </header>
          <div className={cardBodyClass}>
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <span className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-500">
                {selectedSubtitle}
              </span>
              <div className="flex items-center gap-1">
                {!isSelectedActive && (
                  <button
                    type="button"
                    onClick={() => setSelectedDay(activeSchoolDay)}
                    className="mr-1 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    Today
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDay((d) => prevSchoolDayDate(d))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Previous day"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDay((d) => nextSchoolDayDate(d))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
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
                  <ul className={lessonListClass}>
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
          </div>
        </section>

        {/* Lunch */}
        <LunchCard />

        {/* Assignments this week */}
        <AssignmentsCard />

        {/* Plannings this week */}
        <PlanningsCard />

        {/* Upcoming events */}
        <Card
          title="Upcoming events"
          accent="green"
          linkTo="/calendar"
          linkLabel="Full calendar →"
          size="half"
        >
          {loading ? (
            <div className={cardLoadingClass}>Loading…</div>
          ) : upcoming.length === 0 && !eva.nextEvent ? (
            <Empty>Nothing scheduled.</Empty>
          ) : (
            <ul className={eventListClass}>
              {eva.nextEvent && (
                <li className={eventRowClass}>
                  <div>
                    <div className={eventWhenRelClass}>
                      {relativeDay(new Date(eva.nextEvent.fromDate).getTime())}
                    </div>
                    <div className={eventWhenTimeClass}>
                      {formatTime(new Date(eva.nextEvent.fromDate).getTime())}
                    </div>
                  </div>
                  <div>
                    <div className={eventTitleClass}>{eva.nextEvent.title}</div>
                    {eva.nextEvent.eventTypeInfo && (
                      <div className={eventMetaClass}>{eva.nextEvent.eventTypeInfo}</div>
                    )}
                  </div>
                </li>
              )}
              {upcoming.map((ev) => (
                <li key={ev.id} className={eventRowClass}>
                  <div>
                    <div className={eventWhenRelClass}>{relativeDay(ev.eventStart)}</div>
                    <div className={eventWhenTimeClass}>{formatTime(ev.eventStart)}</div>
                  </div>
                  <div>
                    <div className={eventTitleClass}>{ev.title}</div>
                    {ev.eventTypeInfo && <div className={eventMetaClass}>{ev.eventTypeInfo}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* News */}
        <Card
          title="Latest news"
          accent="purple"
          linkTo="/news"
          linkLabel="More news →"
          size="half"
        >
          {newsLoading ? (
            <NewsSkeletonList count={3} />
          ) : eva.news.length === 0 && latestLegacyNews.length === 0 ? (
            <Empty>No recent news.</Empty>
          ) : (
            <ul className={newsListClass}>
              {eva.news.length > 0
                ? eva.news.slice(0, 3).map((n) => {
                    const cat = n.category;
                    const dateLabel = formatDate(new Date(n.creDate).getTime(), {
                      month: "short",
                      day: "numeric",
                    });
                    const author = n.author?.name ?? "School";
                    const preview = previewText(n.description);
                    return (
                      <li key={n.id} className={newsItemClass}>
                        <Avatar name={author} picture={n.author?.picture || null} size={32} />
                        <button
                          type="button"
                          className={newsItemButtonClass}
                          onClick={() => {
                            setOpenNews({
                              title: n.title,
                              description: n.description,
                              dateLabel: formatDate(new Date(n.creDate).getTime(), {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              }),
                              categoryLabel: cat,
                              authorName: author,
                              authorPicture: n.author?.picture || null,
                              hasAttachment: n.hasAttachment ?? false,
                            });
                          }}
                        >
                          <div className={newsBodyClass}>
                            <div className={newsMetaRowClass}>
                              <span className={newsAuthorClass}>{author}</span>
                              {cat && (
                                <span
                                  className={newsCategoryClass}
                                  style={{
                                    background: `${newsCategoryColor(cat)}1f`,
                                    color: newsCategoryColor(cat),
                                  }}
                                >
                                  {cat}
                                </span>
                              )}
                              <span className={newsDateClass}>{dateLabel}</span>
                              {n.hasAttachment && (
                                <span className={newsAttachClass} aria-label="Has attachment">
                                  📎
                                </span>
                              )}
                            </div>
                            <div className={newsTitleClass}>{n.title.trim()}</div>
                            <div className={newsDescClass}>{preview}</div>
                          </div>
                        </button>
                      </li>
                    );
                  })
                : latestLegacyNews.map((n) => {
                    const dateLabel = formatDate(n.eventStart, {
                      month: "short",
                      day: "numeric",
                    });
                    const preview = previewText(n.description);
                    return (
                      <li key={n.id} className={newsItemClass}>
                        <Avatar name="School" picture={null} size={32} />
                        <button
                          type="button"
                          className={newsItemButtonClass}
                          onClick={() => {
                            setOpenNews({
                              title: n.title,
                              description: n.description,
                              dateLabel: formatDate(n.eventStart, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              }),
                              categoryLabel: n.eventTypeInfo,
                            });
                          }}
                        >
                          <div className={newsBodyClass}>
                            <div className={newsMetaRowClass}>
                              <span className={newsAuthorClass}>School</span>
                              {n.eventTypeInfo && (
                                <span
                                  className={newsCategoryClass}
                                  style={{
                                    background: `${newsCategoryColor(n.eventTypeInfo)}1f`,
                                    color: newsCategoryColor(n.eventTypeInfo),
                                  }}
                                >
                                  {n.eventTypeInfo}
                                </span>
                              )}
                              <span className={newsDateClass}>{dateLabel}</span>
                            </div>
                            <div className={newsTitleClass}>{n.title}</div>
                            <div className={newsDescClass}>{preview}</div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
            </ul>
          )}
        </Card>
      </div>

      <NewsPopover
        open={!!openNews}
        data={openNews}
        onClose={() => {
          setOpenNews(null);
        }}
      />
    </div>
  );
}


/** Map a `ScheduleLesson` from the rest-api schedule onto the legacy `Lesson`
 *  shape so the existing `LessonRow` keeps working unchanged.
 *  - Standard Skolverket subject codes ("Ma", "SO", …) expanded to long names.
 *  - Teacher fields come back as "A,B" without a space — normalize so the row
 *    reads "A, B" cleanly. */
function scheduleLessonsForDate(
  scheduleLessons: ScheduleLesson[],
  date: Date,
): Lesson[] {
  return scheduleLessons
    .filter((l) => l.category === "lesson")
    .filter((l) => sameLocalDate(new Date(l.startDate), date))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((l) => {
      const name = expandSubjectCode(l.name);
      const teacher = l.teacher ? l.teacher.replace(/,\s*/g, ", ") : undefined;
      return {
        id: l.eventId,
        subjectId: l.eventId,
        /* LessonRow / formatLessonTime expects "YYYY-MM-DD HH:MM:SS.0". */
        startTime: `${l.startDate.replace("T", " ")}:00.0`,
        endTime: `${l.endDate.replace("T", " ")}:00.0`,
        groupName: name,
        subjectName: name,
        teacherName: teacher,
        location: l.room || undefined,
        weeks: 0,
      };
    });
}

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

function legacyToTile(l: Lesson | null): EvaLessonTile | null {
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

function Card({
  title,
  accent,
  linkTo,
  linkLabel,
  size,
  children,
}: {
  title: string;
  accent?: "primary" | "warm" | "cool" | "green" | "purple";
  linkTo?: string;
  linkLabel?: string;
  size?: "third" | "half" | "wide";
  children: React.ReactNode;
}) {
  /* `dash-card` defaulted to col-span-12 mobile + col-span-6 from md (further
   * narrowed to col-span-4 at xl in the legacy CSS). We collapse to a simpler
   * three-tier scale that matches the dominant breakpoints: full width on
   * mobile, 6/8/12 columns on md+. */
  const sizeClass =
    size === "wide" ? "md:col-span-8" : size === "half" ? "md:col-span-6" : "md:col-span-6";
  const accentKey = accent ?? "primary";
  return (
    <section className={cn(cardClass, accentClasses[accentKey], sizeClass)}>
      <header className={cardHeaderClass}>
        <h3 className={cardHeaderTitleClass}>{title}</h3>
        {linkTo && (
          <Link className={cardLinkClass} to={linkTo}>
            {linkLabel ?? "See more →"}
          </Link>
        )}
      </header>
      <div className={cardBodyClass}>{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className={cardEmptyClass}>{children}</div>;
}

function LessonRow({ lesson, highlight }: { lesson: Lesson; highlight?: boolean }) {
  const subject = lesson.groupName ?? lesson.subjectName ?? `Subject ${lesson.subjectId}`;
  if (subject === "Break") {
    /* Half-height row for short between-lesson breaks. */
    return (
      <li className="grid grid-cols-[58px_1fr] items-center gap-3 rounded-md border border-slate-100 bg-slate-50/60 px-2.5 py-1 text-slate-500">
        <div className="text-center text-[0.72rem] font-medium leading-[1.1] tabular-nums">
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
    <li className={cn(lessonRowClass, highlight && lessonRowHighlightClass)}>
      <div className={lessonRowTimeClass}>
        {formatLessonTime(lesson.startTime)}
        {lesson.endTime && (
          <>
            <br />
            <span className={lessonRowEndClass}>{formatLessonTime(lesson.endTime)}</span>
          </>
        )}
      </div>
      <div className={lessonRowBodyClass}>
        <div className={lessonRowSubjectClass}>{subject}</div>
        <div className={lessonRowMetaClass}>
          {lesson.location}
          {lesson.location && lesson.teacherName && " · "}
          {lesson.teacherName}
        </div>
      </div>
    </li>
  );
}

function NewsSkeletonList({ count }: { count: number }) {
  return (
    <ul className={newsListClass} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className={cn(newsItemClass, newsItemSkeletonClass)}>
          <Skeleton className="size-8 rounded-full shrink-0" />
          <div className={newsBodyClass}>
            {/* Use the real layout classes so paddings/margins line up exactly with the
             * loaded state — skeleton bars stand in for the text but the boxes match. */}
            <div className={newsMetaRowClass}>
              <Skeleton className={cn(newsSkelBarClass, "w-24")} />
              <Skeleton className={cn(newsSkelPillClass, "w-16")} />
              <Skeleton className={cn(newsSkelBarClass, "w-12")} />
            </div>
            <div className={newsTitleClass}>
              <Skeleton className={cn(newsSkelBarClass, "w-4/5")} />
            </div>
            <div className={cn(newsDescClass, newsDescSkeletonClass)}>
              <Skeleton className={cn(newsSkelBarClass, "w-full")} />
              <Skeleton className={cn(newsSkelBarClass, "w-11/12")} />
              <Skeleton className={cn(newsSkelBarClass, "w-5/6")} />
              <Skeleton className={cn(newsSkelBarClass, "w-full")} />
              <Skeleton className={cn(newsSkelBarClass, "w-3/4")} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* Eva module exports the day-tile fetcher; re-export so the bundler keeps it. */
export const _evaTileTouch = fetchEvaLunchDay;
