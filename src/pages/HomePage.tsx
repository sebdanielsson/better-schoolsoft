import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHeroData } from "../hooks/useHeroData.tsx";
import {
  fetchLessons,
  fetchLunch,
  fetchCalendar,
  fetchNotices,
  fetchEvaLunchWeek,
  fetchEvaLunchDay,
  fetchEvaCurrentLesson,
  fetchEvaNextLesson,
  fetchEvaNews,
  fetchEvaNextCalendarEvent,
  evaLunchToWeek,
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
  type LunchWeek,
} from "../api/schoolsoft.ts";
import Avatar from "../components/Avatar.tsx";
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

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return i === -1 ? s : s.slice(0, i);
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
const cardSubtitleClass = "mb-2.5 text-xs font-semibold uppercase tracking-[0.05em] text-slate-500";
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

const lunchTodayClass = "mb-4";
const lunchTextClass =
  "min-h-[calc(1.4em*2+1.5rem)] whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-[1.4]";
const lunchTextEmptyClass = "italic text-slate-500";
const lunchTextSkeletonClass = "flex flex-col";
const lunchWeekListClass = "flex list-none flex-col gap-1";
const lunchWeekRowClass =
  "grid grid-cols-[44px_1fr] items-baseline gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2";
const lunchWeekRowTodayClass = "!border-amber-500 !bg-amber-50";
const lunchWeekDayClass = "text-[0.7rem] font-bold uppercase tracking-[0.05em] text-slate-500";
const lunchWeekDayTodayClass = "!text-amber-700";
const lunchWeekMealClass = "min-w-0 break-words text-[0.85rem] leading-[1.35]";

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
  const [lunchWeeks, setLunchWeeks] = useState<LunchWeek[]>([]);
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

    async function loadLunch(
      accessToken: string | null,
      legacyToken: string,
    ): Promise<LunchWeek[]> {
      const week = isoWeek(new Date());
      if (accessToken) {
        try {
          const days = await fetchEvaLunchWeek(session!.school, accessToken, session!.orgId, week);
          const wk = evaLunchToWeek(days);
          if (wk) return [wk];
        } catch {
          /* fall through */
        }
      }
      try {
        return await fetchLunch(session!.school, legacyToken, session!.orgId);
      } catch {
        return [];
      }
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
      const lunchP = loadLunch(evaToken, legacyToken);
      const lists = legacyToken ? loadLegacyLists(legacyToken) : Promise.resolve();

      const [evaData, lunchData] = await Promise.all([evaDataP, lunchP]);
      if (cancelled) return;
      /* News arrives via its own parallel fetch — preserve whatever's already there
       * so the slower bundle doesn't clobber the news we already painted. */
      setEva((prev) => ({ ...evaData, news: prev.news.length ? prev.news : evaData.news }));
      setLunchWeeks(lunchData);
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

  /* Today's lessons (only on weekdays). */
  const todayLessons = useMemo(() => {
    if (todayDayIdx > 5) return [];
    return lessons
      .filter((l) => l.weeks && bitmaskToWeeks(l.weeks).includes(todayWeek))
      .filter((l) => lessonDayIndex(l.startTime) === todayDayIdx)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [lessons, todayWeek, todayDayIdx]);

  /* Next school day (skips weekend). */
  const { nextDayIdx, nextDayWeek, nextDayIsTomorrow } = useMemo(() => {
    let idx = todayDayIdx;
    let week = todayWeek;
    let dayOffset = 1;
    while (dayOffset <= 4) {
      idx = idx === 7 ? 1 : idx + 1;
      if (idx === 1 && dayOffset > 1) week = todayWeek + 1;
      if (idx >= 1 && idx <= 5) break;
      dayOffset++;
    }
    return { nextDayIdx: idx, nextDayWeek: week, nextDayIsTomorrow: dayOffset === 1 };
  }, [todayDayIdx, todayWeek]);

  const nextDayLessons = useMemo(() => {
    return lessons
      .filter((l) => l.weeks && bitmaskToWeeks(l.weeks).includes(nextDayWeek))
      .filter((l) => lessonDayIndex(l.startTime) === nextDayIdx)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [lessons, nextDayWeek, nextDayIdx]);

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

  /* This week's lunch. */
  const thisWeekLunch = useMemo(
    () => lunchWeeks.find((w) => w.week === todayWeek) ?? lunchWeeks[0] ?? null,
    [lunchWeeks, todayWeek],
  );
  const LUNCH_DAY_KEYS: Array<keyof LunchWeek> = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const todayLunchText = thisWeekLunch
    ? (thisWeekLunch[LUNCH_DAY_KEYS[todayDayIdx % 7] ?? "monday"] as string)
    : "";

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
  const showCurrent: EvaLessonTile | null = evaCurrent ?? legacyToTile(fallbackCurrent);
  const showNext: EvaLessonTile | null = evaNext ?? legacyToTile(fallbackNext);

  return (
    <div className={homePageClass}>
      {error && (
        <div className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <div className={dashGridClass}>
        {/* Now / Next */}
        <Card
          title={todayDayIdx > 5 ? "Next school day" : "Today at school"}
          accent="primary"
          linkTo="/schedule"
          linkLabel="Full schedule →"
        >
          {loading ? (
            <div className={cardLoadingClass}>Loading…</div>
          ) : todayDayIdx > 5 ? (
            nextDayLessons.length ? (
              <>
                <div className={cardSubtitleClass}>
                  {DAY_NAMES_FULL[nextDayIdx]} · Week {nextDayWeek}
                </div>
                <ul className={lessonListClass}>
                  {nextDayLessons.slice(0, 8).map((l) => (
                    <LessonRow key={l.id} lesson={l} />
                  ))}
                </ul>
              </>
            ) : (
              <Empty>No lessons next school day.</Empty>
            )
          ) : showCurrent || showNext || todayLessons.length ? (
            <>
              {showCurrent && (
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
              {showNext && !showCurrent && (
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
              {todayLessons.length > 0 && (
                <ul className={lessonListClass}>
                  {todayLessons.map((l) => (
                    <LessonRow key={l.id} lesson={l} highlight={showCurrent?.lessonId === l.id} />
                  ))}
                </ul>
              )}
              {todayLessons.length === 0 && !showCurrent && !showNext && (
                <Empty>No more lessons today.</Empty>
              )}
            </>
          ) : (
            <Empty>No lessons today — enjoy!</Empty>
          )}
        </Card>

        {/* Lunch */}
        <Card title="Lunch" accent="warm" linkTo="/lunch" linkLabel="All weeks →">
          <div className={cardSubtitleClass}>
            {todayDayIdx >= 1 && todayDayIdx <= 5
              ? `Today · ${DAY_NAMES_FULL[todayDayIdx]}`
              : "This weekend"}
          </div>
          <div className={lunchTodayClass}>
            {loading ? (
              <div className={cn(lunchTextClass, lunchTextSkeletonClass)} aria-hidden="true">
                <Skeleton className="h-4 w-3/4 rounded-sm" />
                <Skeleton className="h-4 w-2/3 rounded-sm mt-2" />
              </div>
            ) : todayDayIdx >= 1 && todayDayIdx <= 5 && todayLunchText ? (
              <pre className={lunchTextClass}>{todayLunchText}</pre>
            ) : (
              <pre className={cn(lunchTextClass, lunchTextEmptyClass)}>
                {todayDayIdx >= 1 && todayDayIdx <= 5
                  ? "No lunch published for today."
                  : "The cafeteria is closed."}
              </pre>
            )}
          </div>
          <ul className={lunchWeekListClass}>
            {(["monday", "tuesday", "wednesday", "thursday", "friday"] as const).map((k, i) => {
              const day = i + 1;
              const text = thisWeekLunch ? (thisWeekLunch[k] as string) || "" : "";
              const isToday = day === todayDayIdx;
              const main = firstLine(text).replace(/^Veckans (lunch|vegetariska)\s*[·:-]?\s*/i, "");
              return (
                <li key={k} className={cn(lunchWeekRowClass, isToday && lunchWeekRowTodayClass)}>
                  <span className={cn(lunchWeekDayClass, isToday && lunchWeekDayTodayClass)}>
                    {DAY_NAMES_FULL[day]?.slice(0, 3)}
                  </span>
                  <span className={lunchWeekMealClass}>
                    {loading ? <Skeleton className="h-3.5 w-2/3 rounded-sm" /> : main || "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Tomorrow / Next school day */}
        {todayDayIdx <= 5 && (
          <Card
            title={nextDayIsTomorrow ? "Tomorrow" : DAY_NAMES_FULL[nextDayIdx]}
            accent="cool"
            linkTo="/schedule"
            linkLabel="View week →"
          >
            {loading ? (
              <div className={cardLoadingClass}>Loading…</div>
            ) : nextDayLessons.length === 0 ? (
              <Empty>No lessons scheduled.</Empty>
            ) : (
              <>
                <div className={cardSubtitleClass}>
                  {DAY_NAMES_FULL[nextDayIdx]} · Week {nextDayWeek}
                </div>
                <ul className={lessonListClass}>
                  {nextDayLessons.slice(0, 8).map((l) => (
                    <LessonRow key={l.id} lesson={l} />
                  ))}
                </ul>
              </>
            )}
          </Card>
        )}

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
        <div className={lessonRowSubjectClass}>
          {lesson.groupName ?? lesson.subjectName ?? `Subject ${lesson.subjectId}`}
        </div>
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
