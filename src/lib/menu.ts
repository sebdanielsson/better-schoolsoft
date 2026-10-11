/** Which sections a child has, from the iOS app's per-child menu
 *  (`v4/schools/{orgId}/parents/{parentId}/menu?studentId=`). The official
 *  app shows a module only when the menu lists it; schools switch modules
 *  off, and siblings at different schools or stages get different menus.
 *
 *  Messages, the school page and the profile are always shown: the iOS app
 *  keeps them outside the menu, and the web app always has them. */

/** Menu types the app has a section for. The menu can list others
 *  (`STUDENT_LEAVE`, `BLOG`, …) for modules we don't implement yet. */
export type Feature =
  | "SCHEDULE"
  | "ABSENCE"
  | "LUNCH"
  | "NEWS"
  | "STAFF_LIST"
  | "SUBJECT_ROOMS"
  | "HOLISTIC_ASSESSMENT"
  | "BOOKINGS";

/** `null` while the menu is loading or if it couldn't be fetched: show
 *  everything, as before the menu was used, rather than hide sections a
 *  guardian may well have. */
export type Menu = ReadonlySet<string> | null;

export const menuKey = (prefix: string) => `${prefix}menu`;

export function menuFromResponse(rows: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    const type = (r as { type?: unknown } | null)?.type;
    if (typeof type === "string") out.add(type);
  }
  return out;
}

export function hasFeature(menu: Menu, feature: Feature): boolean {
  return menu === null || menu.has(feature);
}

/** The feature each gated route belongs to. Routes not listed are always
 *  available. Calendar sits under the schedule, as "Schema & Kalender" does
 *  on the web; assignment and planning pages belong to the subject rooms. */
const ROUTE_FEATURE: [prefix: string, feature: Feature][] = [
  ["/schedule", "SCHEDULE"],
  ["/calendar", "SCHEDULE"],
  ["/absence", "ABSENCE"],
  ["/news", "NEWS"],
  ["/staff", "STAFF_LIST"],
  ["/subjects", "SUBJECT_ROOMS"],
  ["/assignments", "SUBJECT_ROOMS"],
  ["/plannings", "SUBJECT_ROOMS"],
  ["/assessments", "HOLISTIC_ASSESSMENT"],
  ["/bookings", "BOOKINGS"],
];

export function featureForPath(pathname: string): Feature | null {
  /* React Router matches routes case-insensitively, so must this. */
  const path = pathname.toLowerCase();
  for (const [prefix, feature] of ROUTE_FEATURE) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return feature;
  }
  return null;
}

export function pathAllowed(menu: Menu, pathname: string): boolean {
  const feature = featureForPath(pathname);
  return feature === null || hasFeature(menu, feature);
}
