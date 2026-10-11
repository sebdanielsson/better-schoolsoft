import { useCallback, useEffect, useMemo } from "react";
import { useSchoolsoftContext, type SchoolsoftContext } from "./useSchoolsoftContext.tsx";
import { useQuery } from "./useQuery.ts";
import { useHeroData } from "./useHeroData.tsx";
import {
  fetchAllSubjectRoomAssignments,
  fetchAllSubjectRoomPlannings,
  fetchAllSubjectRoomResults,
  fetchAssignmentAssessment,
  fetchAssignmentView,
  fetchEvaMessages,
  fetchEvaNewsFeed,
  fetchEvaTimebookings,
  fetchHolisticAssessmentDetail,
  fetchHolisticAssessments,
  fetchPlanningPartView,
  markEvaNewsRead,
  markEvaTimebookingRead,
  setEvaMessageRead,
} from "../api/schoolsoft.ts";
import {
  countBySection,
  fromAssessments,
  fromAssignments,
  fromBookings,
  fromMessages,
  fromNews,
  fromPlannings,
  fromResults,
  NOTIFICATIONS_KEY,
  sortNotifications,
  type NotificationItem,
} from "../lib/notifications.ts";
import { getQueryEntry, invalidateQueries, isStale, setQueryData } from "../lib/query-cache.ts";

type Source =
  | "messages"
  | "news"
  | "bookings"
  | "assignments"
  | "results"
  | "plannings"
  | "assessments";

const key = (ctx: SchoolsoftContext, source: Source) =>
  `${NOTIFICATIONS_KEY}${ctx.keyPrefix}${source}`;

const STALE_MS = 2 * 60_000;

/** Kinds stored under each source key, for removing an item optimistically. */
const SOURCE_OF: Record<NotificationItem["kind"], Source> = {
  message: "messages",
  news: "news",
  booking: "bookings",
  assignment: "assignments",
  result: "results",
  planning: "plannings",
  assessment: "assessments",
};
const SOURCES = Object.values(SOURCE_OF);

export interface Notifications {
  /** Unread items, newest first. Empty while loading. */
  items: NotificationItem[];
  /** True until every source has answered (or failed) once. */
  loading: boolean;
  /** Sources that couldn't be loaded, so the UI can say the list may be partial. */
  failed: Source[];
  bySection: Record<string, number>;
  /** Mark one item read on the server, then drop it from the list. */
  markRead: (item: NotificationItem) => Promise<void>;
  /** Mark everything read. Resolves to the number of items that failed. */
  markAllRead: () => Promise<number>;
  refresh: () => void;
}

/** Unread items for the child in focus, across messages, news, bookings,
 *  subject rooms and holistic assessments. Each source is cached separately,
 *  so the hero pill, the section badges and the panel share one fetch. */
export function useNotifications(): Notifications {
  const ctx = useSchoolsoftContext();
  const { refreshCounts, loading: heroLoading } = useHeroData();
  const opts = { staleMs: STALE_MS };

  const messages = useQuery(
    ctx && key(ctx, "messages"),
    async () =>
      fromMessages(
        await fetchEvaMessages(
          ctx!.school,
          await ctx!.token(),
          ctx!.parentUserId,
          ctx!.orgId,
          "inbox",
        ),
      ),
    opts,
  );
  const news = useQuery(
    ctx && key(ctx, "news"),
    async () =>
      fromNews(
        await fetchEvaNewsFeed(
          ctx!.school,
          await ctx!.token(),
          ctx!.parentUserId,
          ctx!.orgId,
          ctx!.studentId,
          "current",
        ),
      ),
    opts,
  );
  const bookings = useQuery(
    ctx && key(ctx, "bookings"),
    async () =>
      fromBookings(
        await fetchEvaTimebookings(
          ctx!.school,
          await ctx!.token(),
          ctx!.parentUserId,
          ctx!.studentId,
          ctx!.orgId,
        ),
      ),
    opts,
  );
  const assignments = useQuery(
    ctx && key(ctx, "assignments"),
    () =>
      ctx!.withCookies(async () =>
        fromAssignments(await fetchAllSubjectRoomAssignments(ctx!.school)),
      ),
    opts,
  );
  const results = useQuery(
    ctx && key(ctx, "results"),
    () => ctx!.withCookies(async () => fromResults(await fetchAllSubjectRoomResults(ctx!.school))),
    opts,
  );
  const plannings = useQuery(
    ctx && key(ctx, "plannings"),
    () =>
      ctx!.withCookies(async () => fromPlannings(await fetchAllSubjectRoomPlannings(ctx!.school))),
    opts,
  );
  const assessments = useQuery(
    ctx && key(ctx, "assessments"),
    () =>
      ctx!.withCookies(async () => fromAssessments(await fetchHolisticAssessments(ctx!.school))),
    opts,
  );

  const sources = { messages, news, bookings, assignments, results, plannings, assessments };

  const items = useMemo(
    () =>
      sortNotifications([
        ...(messages.data ?? []),
        ...(news.data ?? []),
        ...(bookings.data ?? []),
        ...(assignments.data ?? []),
        ...(results.data ?? []),
        ...(plannings.data ?? []),
        ...(assessments.data ?? []),
      ]),
    [
      messages.data,
      news.data,
      bookings.data,
      assignments.data,
      results.data,
      plannings.data,
      assessments.data,
    ],
  );

  const loading = Object.values(sources).some((q) => q.loading);
  const failed = (Object.keys(sources) as Source[]).filter(
    (s) => sources[s].error && !sources[s].data,
  );

  /* New things arrive while the tab sits in the background; refresh when the
   * guardian comes back to it. Only stale sources refetch, and not while a
   * fetch is in flight: `focus` and `visibilitychange` usually fire together,
   * and every mounted instance of this hook listens. */
  useEffect(() => {
    if (!ctx) return;
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      for (const source of SOURCES) {
        const k = key(ctx, source);
        const entry = getQueryEntry(k);
        if (!entry.promise && isStale(entry, STALE_MS)) invalidateQueries(k);
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [ctx]);

  const markRead = useCallback(
    async (item: NotificationItem) => {
      if (!ctx) return;
      await markItemRead(ctx, item);
      /* Drop it right away; the source refetches in the background. */
      const k = key(ctx, SOURCE_OF[item.kind]);
      const current = getQueryEntry<NotificationItem[]>(k).data;
      if (current)
        setQueryData(
          k,
          current.filter((i) => i.key !== item.key),
        );
      invalidatePageCaches(ctx, item);
      refreshCounts();
    },
    [ctx, refreshCounts],
  );

  const markAllRead = useCallback(async () => {
    if (!ctx) return 0;
    const all = items;
    let failures = 0;
    /* A few at a time: dozens of parallel writes would trip rate limits and
     * queue behind the 6-connection cap anyway. */
    for (let i = 0; i < all.length; i += 4) {
      const batch = all.slice(i, i + 4);
      const settled = await Promise.allSettled(batch.map((item) => markItemRead(ctx, item)));
      failures += settled.filter((r) => r.status === "rejected").length;
    }
    invalidateQueries(`${NOTIFICATIONS_KEY}${ctx.keyPrefix}`);
    invalidateQueries(ctx.keyPrefix);
    refreshCounts();
    return failures;
  }, [ctx, items, refreshCounts]);

  const refresh = useCallback(() => {
    if (ctx) invalidateQueries(`${NOTIFICATIONS_KEY}${ctx.keyPrefix}`);
  }, [ctx]);

  return {
    items,
    /* No context (no child, or /parent failed): nothing to load. */
    loading: ctx ? loading : heroLoading,
    failed,
    bySection: countBySection(items),
    markRead,
    markAllRead,
    refresh,
  };
}

/** The server-side read marker for one item. Subject-room items and
 *  assessments have no explicit "mark read" call: opening them is what marks
 *  them read, so this fetches the same detail the page would. */
async function markItemRead(ctx: SchoolsoftContext, item: NotificationItem): Promise<void> {
  switch (item.kind) {
    case "message":
      return setEvaMessageRead(
        ctx.school,
        await ctx.token(),
        ctx.parentUserId,
        ctx.orgId,
        item.id,
        true,
      );
    case "news":
      return markEvaNewsRead(ctx.school, await ctx.token(), ctx.parentUserId, ctx.orgId, item.id);
    case "booking":
      return markEvaTimebookingRead(ctx.school, await ctx.token(), ctx.parentUserId, item.id);
    case "assignment":
      await ctx.withCookies(() => fetchAssignmentView(ctx.school, item.id));
      return;
    case "result":
      await ctx.withCookies(() => fetchAssignmentAssessment(ctx.school, item.id));
      return;
    case "planning":
      await ctx.withCookies(() => fetchPlanningPartView(ctx.school, item.id));
      return;
    case "assessment":
      await ctx.withCookies(() => fetchHolisticAssessmentDetail(ctx.school, item.id));
      return;
  }
}

/** Pages keep their own caches of these lists (with read dots); refresh the
 *  ones an item appears in so they don't show it as unread afterwards. */
function invalidatePageCaches(ctx: SchoolsoftContext, item: NotificationItem) {
  switch (item.kind) {
    case "message":
      invalidateQueries(`${ctx.keyPrefix}messages:`);
      invalidateQueries(`${ctx.keyPrefix}message:${item.id}`);
      return;
    case "news":
      invalidateQueries(`${ctx.keyPrefix}news:`);
      return;
    case "booking":
      invalidateQueries(`${ctx.keyPrefix}timebooking`);
      return;
    default:
      invalidateQueries(`${ctx.keyPrefix}subjectroom`);
  }
}

/** For detail pages whose own fetch marks the item read on the server
 *  (assignments, results, plannings, assessments): once `ready`, drop the
 *  matching items from the notification center and refresh the counts. Does
 *  nothing (no requests) when the item wasn't unread. */
export function useNoteOpened(
  entries: { kind: NotificationItem["kind"]; id: number }[],
  ready: boolean,
): void {
  const ctx = useSchoolsoftContext();
  const { refreshCounts } = useHeroData();
  const signature = entries.map((e) => `${e.kind}:${e.id}`).join(",");
  useEffect(() => {
    if (!ctx || !ready || !signature) return;
    let changed = false;
    for (const part of signature.split(",")) {
      const [kind, rawId] = part.split(":") as [NotificationItem["kind"], string];
      const k = key(ctx, SOURCE_OF[kind]);
      const current = getQueryEntry<NotificationItem[]>(k).data;
      if (current?.some((i) => i.key === part)) {
        setQueryData(
          k,
          current.filter((i) => i.key !== part),
        );
        invalidatePageCaches(ctx, { kind, id: Number(rawId) } as NotificationItem);
        changed = true;
      }
    }
    if (changed) refreshCounts();
  }, [ctx, ready, signature, refreshCounts]);
}
