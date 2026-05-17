import { useEffect, useState } from "react";
import { useAuth } from "./useAuth.tsx";
import { useHeroData } from "./useHeroData.tsx";
import {
  getSchoolsoftParameters,
  type SchoolsoftParameters,
} from "../api/schoolsoft.ts";

/** Resolves SchoolSoft's per-school parameters once and shares the result via
 *  the module-level cache in api/schoolsoft.ts. Returns `null` until resolved.
 *  Components that gate on a flag should render nothing (or a skeleton) until
 *  the value is non-null. */
export function useSchoolsoftParameters(): SchoolsoftParameters | null {
  const { session, getEvaToken } = useAuth();
  const { parentUserId, child } = useHeroData();
  const [params, setParams] = useState<SchoolsoftParameters | null>(null);

  useEffect(() => {
    if (!session || !parentUserId || !child) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getEvaToken();
        if (!token) return;
        const orgId = child.schools[0]?.orgId ?? session.orgId;
        const p = await getSchoolsoftParameters(
          session.school,
          token,
          parentUserId,
          orgId,
          child.studentId,
        );
        if (!cancelled) setParams(p);
      } catch {
        /* swallow — callers default to "hidden" until value resolves */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, parentUserId, child]);

  return params;
}
