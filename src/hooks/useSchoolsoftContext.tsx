import { useCallback, useMemo } from "react";
import { useAuth } from "./useAuth.tsx";
import { useHeroData } from "./useHeroData.tsx";
import {
  acquireCookieFocus,
  bootstrapSchoolsoftSession,
  cookieSessionFocus,
} from "../api/schoolsoft.ts";

export interface SchoolsoftContext {
  school: string;
  parentUserId: number;
  orgId: number;
  studentId: number;
  /** Prefix for query-cache keys. Includes the child so data never bleeds
   *  between siblings once a child switcher exists. */
  keyPrefix: string;
  /** A valid Eva access token, refreshed if needed. Throws when signed out. */
  token: () => Promise<string>;
  /** Ensure the cookie session that `/rest-api/*` endpoints need. Idempotent
   *  and cheap after the first call; returns the token for convenience. */
  cookieSession: () => Promise<string>;
  /** Run a cookie-session request for this child. The session has one child
   *  in focus server-side, so if a switch re-focuses it mid-request the
   *  response may belong to a sibling: that result is rejected rather than
   *  cached under this child's keys. */
  withCookies: <T>(fn: () => Promise<T>) => Promise<T>;
}

/** Everything a page needs to call SchoolSoft for the child in focus, or `null`
 *  while the session and child are still resolving. */
export function useSchoolsoftContext(): SchoolsoftContext | null {
  const { session, getEvaToken } = useAuth();
  const { parentUserId, child } = useHeroData();

  const school = session?.school;
  const orgId = child?.schools[0]?.orgId ?? session?.orgId;
  const studentId = child?.studentId;

  const token = useCallback(async () => {
    const t = await getEvaToken();
    if (!t) throw new Error("You are signed out. Sign in again to continue.");
    return t;
  }, [getEvaToken]);

  const cookieSession = useCallback(async () => {
    if (!school || !parentUserId || !orgId || !studentId) {
      throw new Error("Session is not ready yet");
    }
    const t = await token();
    await bootstrapSchoolsoftSession(school, t, parentUserId, orgId, studentId);
    return t;
  }, [school, parentUserId, orgId, studentId, token]);

  const withCookies = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      if (!school || !parentUserId || !orgId || !studentId) {
        throw new Error("Session is not ready yet");
      }
      /* The token of the exchange we actually waited on — not a re-read of
       * the global, which may already name a sibling's queued switch. */
      const focus = await acquireCookieFocus(school, await token(), parentUserId, orgId, studentId);
      const result = await fn();
      /* Any re-bootstrap since (another child, or back to this one) replaced
       * the focus token, so the response may have been served for a sibling. */
      if (cookieSessionFocus() !== focus) {
        throw new Error("The child in focus changed while loading. Try again.");
      }
      return result;
    },
    [school, parentUserId, orgId, studentId, token],
  );

  return useMemo(() => {
    if (!school || !parentUserId || !orgId || !studentId) return null;
    return {
      school,
      parentUserId,
      orgId,
      studentId,
      keyPrefix: `${school}:${orgId}:${studentId}:`,
      token,
      cookieSession,
      withCookies,
    };
  }, [school, parentUserId, orgId, studentId, token, cookieSession, withCookies]);
}
