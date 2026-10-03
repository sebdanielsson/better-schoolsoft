import { useCallback, useMemo } from "react";
import { useAuth } from "./useAuth.tsx";
import { useHeroData } from "./useHeroData.tsx";
import { bootstrapSchoolsoftSession } from "../api/schoolsoft.ts";

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
    };
  }, [school, parentUserId, orgId, studentId, token, cookieSession]);
}
