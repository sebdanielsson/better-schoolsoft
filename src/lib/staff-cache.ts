import { fetchEvaStaffDetail, type EvaStaffDetail } from "../api/schoolsoft.ts";
import { schedule } from "./fetch-scheduler.ts";

/** Resolved staff detail by teacherId. Module-level so the StaffPage preloader
 *  and the StaffPopover share the same store, and the cache survives navigation
 *  for the lifetime of the tab. */
export const staffDetailCache = new Map<number, EvaStaffDetail>();
const staffDetailInflight = new Map<number, Promise<EvaStaffDetail>>();

/** Fetch a staff detail at high priority, deduping concurrent callers and
 *  caching the result. Used both by the StaffPage preload pass and by the
 *  popover's on-demand fetch (for the rare cache miss). */
export function preloadStaffDetail(
  school: string,
  accessToken: string,
  orgId: number,
  teacherId: number,
): Promise<EvaStaffDetail> {
  const cached = staffDetailCache.get(teacherId);
  if (cached) return Promise.resolve(cached);
  const inflight = staffDetailInflight.get(teacherId);
  if (inflight) return inflight;

  const p = schedule("high", () =>
    fetchEvaStaffDetail(school, accessToken, orgId, teacherId),
  )
    .then((data) => {
      staffDetailCache.set(teacherId, data);
      return data;
    })
    .finally(() => {
      staffDetailInflight.delete(teacherId);
    });

  staffDetailInflight.set(teacherId, p);
  return p;
}
