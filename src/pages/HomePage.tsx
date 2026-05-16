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
    <div className="home-page">
      {error && <div className="error-message">{error}</div>}

      <div className="dash-grid">
        {/* Now / Next */}
        <Card
          title={todayDayIdx > 5 ? "Next school day" : "Today at school"}
          accent="primary"
          linkTo="/schedule"
          linkLabel="Full schedule →"
        >
          {loading ? (
            <div className="card-loading">Loading…</div>
          ) : todayDayIdx > 5 ? (
            nextDayLessons.length ? (
              <>
                <div className="card-subtitle">
                  {DAY_NAMES_FULL[nextDayIdx]} · Week {nextDayWeek}
                </div>
                <ul className="lesson-list compact">
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
                <div className="now-block">
                  <div className="now-label">Now</div>
                  <div className="now-title">
                    {showCurrent.subjectName ?? showCurrent.groupName ?? "Lesson"}
                  </div>
                  <div className="now-meta">
                    {showCurrent.startTime && formatLessonTime(showCurrent.startTime)}
                    {showCurrent.endTime && `–${formatLessonTime(showCurrent.endTime)}`}
                    {showCurrent.location && ` · ${showCurrent.location}`}
                    {showCurrent.teacherName && ` · ${showCurrent.teacherName}`}
                  </div>
                </div>
              )}
              {showNext && !showCurrent && (
                <div className="now-block">
                  <div className="now-label">Next up</div>
                  <div className="now-title">
                    {showNext.subjectName ?? showNext.groupName ?? "Lesson"}
                  </div>
                  <div className="now-meta">
                    {showNext.startTime && formatLessonTime(showNext.startTime)}
                    {showNext.endTime && `–${formatLessonTime(showNext.endTime)}`}
                    {showNext.location && ` · ${showNext.location}`}
                  </div>
                </div>
              )}
              {todayLessons.length > 0 && (
                <ul className="lesson-list compact">
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
          <div className="card-subtitle">
            {todayDayIdx >= 1 && todayDayIdx <= 5
              ? `Today · ${DAY_NAMES_FULL[todayDayIdx]}`
              : "This weekend"}
          </div>
          <div className="lunch-today">
            {loading ? (
              <div className="lunch-text lunch-text--skeleton" aria-hidden="true">
                <Skeleton className="h-4 w-3/4 rounded-sm" />
                <Skeleton className="h-4 w-2/3 rounded-sm mt-2" />
              </div>
            ) : todayDayIdx >= 1 && todayDayIdx <= 5 && todayLunchText ? (
              <pre className="lunch-text">{todayLunchText}</pre>
            ) : (
              <pre className="lunch-text lunch-text--empty">
                {todayDayIdx >= 1 && todayDayIdx <= 5
                  ? "No lunch published for today."
                  : "The cafeteria is closed."}
              </pre>
            )}
          </div>
          <ul className="lunch-week-list">
            {(["monday", "tuesday", "wednesday", "thursday", "friday"] as const).map((k, i) => {
              const day = i + 1;
              const text = thisWeekLunch ? (thisWeekLunch[k] as string) || "" : "";
              const isToday = day === todayDayIdx;
              const main = firstLine(text).replace(/^Veckans (lunch|vegetariska)\s*[·:-]?\s*/i, "");
              return (
                <li key={k} className={`lunch-week-row ${isToday ? "is-today" : ""}`}>
                  <span className="lunch-week-day">{DAY_NAMES_FULL[day]?.slice(0, 3)}</span>
                  <span className="lunch-week-meal">
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
              <div className="card-loading">Loading…</div>
            ) : nextDayLessons.length === 0 ? (
              <Empty>No lessons scheduled.</Empty>
            ) : (
              <>
                <div className="card-subtitle">
                  {DAY_NAMES_FULL[nextDayIdx]} · Week {nextDayWeek}
                </div>
                <ul className="lesson-list compact">
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
            <div className="card-loading">Loading…</div>
          ) : upcoming.length === 0 && !eva.nextEvent ? (
            <Empty>Nothing scheduled.</Empty>
          ) : (
            <ul className="event-list-compact">
              {eva.nextEvent && (
                <li className="event-row">
                  <div className="event-when">
                    <div className="event-when-rel">
                      {relativeDay(new Date(eva.nextEvent.fromDate).getTime())}
                    </div>
                    <div className="event-when-time">
                      {formatTime(new Date(eva.nextEvent.fromDate).getTime())}
                    </div>
                  </div>
                  <div className="event-body">
                    <div className="event-title">{eva.nextEvent.title}</div>
                    {eva.nextEvent.eventTypeInfo && (
                      <div className="event-meta">{eva.nextEvent.eventTypeInfo}</div>
                    )}
                  </div>
                </li>
              )}
              {upcoming.map((ev) => (
                <li key={ev.id} className="event-row">
                  <div className="event-when">
                    <div className="event-when-rel">{relativeDay(ev.eventStart)}</div>
                    <div className="event-when-time">{formatTime(ev.eventStart)}</div>
                  </div>
                  <div className="event-body">
                    <div className="event-title">{ev.title}</div>
                    {ev.eventTypeInfo && <div className="event-meta">{ev.eventTypeInfo}</div>}
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
            <ul className="news-list">
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
                      <li key={n.id} className="news-item">
                        <Avatar name={author} picture={n.author?.picture || null} size={32} />
                        <button
                          type="button"
                          className="news-item-button"
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
                          <div className="news-body">
                            <div className="news-meta-row">
                              <span className="news-author">{author}</span>
                              {cat && (
                                <span
                                  className="news-category"
                                  style={{
                                    background: `${newsCategoryColor(cat)}1f`,
                                    color: newsCategoryColor(cat),
                                  }}
                                >
                                  {cat}
                                </span>
                              )}
                              <span className="news-date">{dateLabel}</span>
                              {n.hasAttachment && (
                                <span className="news-attach" aria-label="Has attachment">
                                  📎
                                </span>
                              )}
                            </div>
                            <div className="news-title">{n.title.trim()}</div>
                            <div className="news-desc">{preview}</div>
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
                      <li key={n.id} className="news-item">
                        <Avatar name="School" picture={null} size={32} />
                        <button
                          type="button"
                          className="news-item-button"
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
                          <div className="news-body">
                            <div className="news-meta-row">
                              <span className="news-author">School</span>
                              {n.eventTypeInfo && (
                                <span
                                  className="news-category"
                                  style={{
                                    background: `${newsCategoryColor(n.eventTypeInfo)}1f`,
                                    color: newsCategoryColor(n.eventTypeInfo),
                                  }}
                                >
                                  {n.eventTypeInfo}
                                </span>
                              )}
                              <span className="news-date">{dateLabel}</span>
                            </div>
                            <div className="news-title">{n.title}</div>
                            <div className="news-desc">{preview}</div>
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
  const sizeClass = size === "half" ? "dash-card-half" : size === "wide" ? "dash-card-wide" : "";
  return (
    <section className={`dash-card accent-${accent ?? "primary"} ${sizeClass}`}>
      <header className="dash-card-header">
        <h3>{title}</h3>
        {linkTo && (
          <Link className="dash-card-link" to={linkTo}>
            {linkLabel ?? "See more →"}
          </Link>
        )}
      </header>
      <div className="dash-card-body">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card-empty">{children}</div>;
}

function LessonRow({ lesson, highlight }: { lesson: Lesson; highlight?: boolean }) {
  return (
    <li className={`lesson-row ${highlight ? "is-now" : ""}`}>
      <div className="lesson-row-time">
        {formatLessonTime(lesson.startTime)}
        {lesson.endTime && (
          <>
            <br />
            <span className="lesson-row-end">{formatLessonTime(lesson.endTime)}</span>
          </>
        )}
      </div>
      <div className="lesson-row-body">
        <div className="lesson-row-subject">
          {lesson.groupName ?? lesson.subjectName ?? `Subject ${lesson.subjectId}`}
        </div>
        <div className="lesson-row-meta">
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
    <ul className="news-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="news-item news-item--skeleton">
          <Skeleton className="size-8 rounded-full shrink-0" />
          <div className="news-body">
            {/* Use the real layout classes so paddings/margins line up exactly with the
             * loaded state — skeleton bars stand in for the text but the boxes match. */}
            <div className="news-meta-row">
              <Skeleton className="news-skel-bar w-24" />
              <Skeleton className="news-skel-pill w-16" />
              <Skeleton className="news-skel-bar w-12" />
            </div>
            <div className="news-title">
              <Skeleton className="news-skel-bar w-4/5" />
            </div>
            <div className="news-desc news-desc--skeleton">
              <Skeleton className="news-skel-bar w-full" />
              <Skeleton className="news-skel-bar w-11/12" />
              <Skeleton className="news-skel-bar w-5/6" />
              <Skeleton className="news-skel-bar w-full" />
              <Skeleton className="news-skel-bar w-3/4" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* Eva module exports the day-tile fetcher; re-export so the bundler keeps it. */
export const _evaTileTouch = fetchEvaLunchDay;
