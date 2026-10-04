import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useNow } from "../hooks/useNow.ts";
import { useHeroData } from "../hooks/useHeroData.tsx";
import {
  acquireCookieFocus,
  assertCookieFocus,
  fetchEvaCurrentLesson,
  fetchEvaNextLesson,
  fetchEvaNews,
  fetchScheduleLessons,
  type EvaLessonTile,
  type EvaNewsItem,
  type ScheduleLesson,
} from "../api/schoolsoft.ts";
import AssignmentsCard from "../components/AssignmentsCard.tsx";
import LunchCard from "../components/LunchCard.tsx";
import PlanningsCard from "../components/PlanningsCard.tsx";
import NextBookingCard from "../components/NextBookingCard.tsx";
import ScheduleCard from "../components/home/ScheduleCard.tsx";
import EventsCard from "../components/home/EventsCard.tsx";
import NewsCard from "../components/home/NewsCard.tsx";
import { isoDay, isoWeek } from "../lib/dates.ts";

interface Tiles {
  currentLesson: EvaLessonTile | null;
  nextLesson: EvaLessonTile | null;
}

const noTiles: Tiles = { currentLesson: null, nextLesson: null };
const NO_LESSONS: ScheduleLesson[] = [];

export default function HomePage() {
  const { session, getEvaToken } = useAuth();
  /* Parent userId + child come from the shared hero-data context (loaded once by
   * DashboardPage). This page reuses them for its own Eva fetches instead of
   * re-fetching the parent record. */
  const { parentUserId, child } = useHeroData();

  /* Tagged with the child they belong to, so a sibling switch never shows the
   * previous child's lessons while (or if) the new ones fail to load. */
  const [schedule, setSchedule] = useState<{ child: number; lessons: ScheduleLesson[] } | null>(
    null,
  );
  const [tiles, setTiles] = useState<Tiles>(noTiles);
  const [news, setNews] = useState<EvaNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);

  const today = useNow();
  const todayDayIdx = isoDay(today);

  /* Eva tiles (current/next lesson) and news. News lands on its
   * own so its card can swap from skeleton to list without waiting on the
   * slower tile bundle. */
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setNewsLoading(true);
    /* News is per child; the skeleton covers the gap. */
    setNews([]);

    void (async () => {
      const token = await getEvaToken().catch(() => null);
      const studentId = child?.studentId;
      if (!token || !parentUserId || !studentId) {
        if (!cancelled) {
          setTiles(noTiles);
          setNewsLoading(false);
          setLoading(false);
        }
        return;
      }
      const orgId = child.schools[0]?.orgId ?? session.orgId;

      fetchEvaNews(session.school, token, parentUserId, orgId, studentId)
        .then((list) => {
          if (!cancelled) setNews(list ?? []);
        })
        .catch(() => {
          /* the card shows its empty state */
        })
        .finally(() => {
          if (!cancelled) setNewsLoading(false);
        });

      const week = isoWeek(new Date());
      /* Tiles always describe today; the iOS app clamps the day to 1–5. */
      const day = Math.min(Math.max(todayDayIdx, 1), 5);
      const [cur, nxt] = await Promise.allSettled([
        fetchEvaCurrentLesson(session.school, token, orgId, studentId, week, day),
        fetchEvaNextLesson(session.school, token, orgId, studentId, week, day),
      ]);
      if (cancelled) return;
      setTiles({
        currentLesson: cur.status === "fulfilled" ? cur.value : null,
        nextLesson: nxt.status === "fulfilled" ? nxt.value : null,
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, todayDayIdx, parentUserId, child]);

  /* This and next week from the rest-api schedule endpoint, which is what
   * schools actually populate (Eva's lesson tiles often lack subject names). */
  useEffect(() => {
    if (!session || !parentUserId || !child) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getEvaToken();
        if (!token) return;
        const orgId = child.schools[0]?.orgId ?? session.orgId;
        const focus = await acquireCookieFocus(
          session.school,
          token,
          parentUserId,
          orgId,
          child.studentId,
        );
        const now = new Date();
        const week = isoWeek(now);
        /* Derive the next week from a date rather than `week + 1`, which asked
         * for week 53/54 every December instead of wrapping to week 1. */
        const nextWeekNumber = isoWeek(new Date(now.getTime() + 7 * 86_400_000));
        const [thisWeek, nextWeek] = await Promise.all([
          fetchScheduleLessons(session.school, week).catch(() => [] as ScheduleLesson[]),
          fetchScheduleLessons(session.school, nextWeekNumber).catch(() => [] as ScheduleLesson[]),
        ]);
        assertCookieFocus(focus);
        if (cancelled) return;
        setSchedule({ child: child.studentId, lessons: [...thisWeek, ...nextWeek] });
      } catch {
        /* the card falls back to Eva's tiles alone */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, parentUserId, child]);

  if (!session) return null;

  return (
    <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-12">
      <NextBookingCard />
      <ScheduleCard
        loading={loading}
        scheduleLessons={
          schedule && schedule.child === child?.studentId ? schedule.lessons : NO_LESSONS
        }
        currentTile={tiles.currentLesson}
        nextTile={tiles.nextLesson}
        today={today}
      />
      <LunchCard />
      <AssignmentsCard />
      <PlanningsCard />
      <EventsCard />
      <NewsCard loading={newsLoading} news={news} />
    </div>
  );
}
