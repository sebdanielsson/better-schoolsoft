import { fetchEvaStaffDetail, type EvaStaffDetail } from "../api/schoolsoft.ts";
import { schedule } from "./fetch-scheduler.ts";
import { registerSessionCache } from "./session-caches.ts";

/** Resolved staff detail by org + teacherId. Module-level so the StaffPage
 *  preloader and the StaffPopover share the same store, and the cache survives
 *  navigation for the lifetime of the tab. Keyed by org because teacherId is
 *  only unique within one, and siblings can attend different schools. */
const staffDetailCache = new Map<string, EvaStaffDetail>();
const staffDetailInflight = new Map<string, Promise<EvaStaffDetail>>();

const cacheKey = (orgId: number, teacherId: number) => `${orgId}:${teacherId}`;

export function getCachedStaffDetail(orgId: number, teacherId: number): EvaStaffDetail | undefined {
  return staffDetailCache.get(cacheKey(orgId, teacherId));
}

/* teacherId is only unique within an org, and this cache outlives the session
 * that filled it — so it must be dropped when the session identity changes. */
registerSessionCache(() => {
  staffDetailCache.clear();
  staffDetailInflight.clear();
});

/** Fetch a staff detail at high priority, deduping concurrent callers and
 *  caching the result. Used both by the StaffPage preload pass and by the
 *  popover's on-demand fetch (for the rare cache miss). */
export function preloadStaffDetail(
  school: string,
  accessToken: string,
  orgId: number,
  teacherId: number,
): Promise<EvaStaffDetail> {
  const key = cacheKey(orgId, teacherId);
  const cached = staffDetailCache.get(key);
  if (cached) return Promise.resolve(cached);
  const inflight = staffDetailInflight.get(key);
  if (inflight) return inflight;

  const p = schedule("high", () => fetchEvaStaffDetail(school, accessToken, orgId, teacherId))
    .then((data) => {
      /* Only if this request is still the current one: a logout/account
       * switch clears the inflight map, so a late response must not refill
       * the cache with the previous session's data. */
      if (staffDetailInflight.get(key) === p) staffDetailCache.set(key, data);
      return data;
    })
    .finally(() => {
      if (staffDetailInflight.get(key) === p) staffDetailInflight.delete(key);
    });

  staffDetailInflight.set(key, p);
  return p;
}
