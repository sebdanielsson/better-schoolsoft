import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { useAuth } from "./useAuth.tsx";
import {
  fetchEvaBadgeCounts,
  fetchEvaParent,
  fetchEvaUnreadMessages,
  type EvaBadgeCounts,
  type EvaChild,
} from "../api/schoolsoft.ts";

export interface HeroData {
  /** Parent's userId (resolved from the Eva /parent endpoint). */
  parentUserId: number | null;
  /** First child on the parent's account, or null while loading / for non-guardian users. */
  child: EvaChild | null;
  unread: number;
  badges: EvaBadgeCounts;
  /** True while the parent + unread + badges fetches are in flight. */
  loading: boolean;
}

const emptyState: HeroData = {
  parentUserId: null,
  child: null,
  unread: 0,
  badges: {},
  loading: true,
};

const HeroDataContext = createContext<HeroData>(emptyState);

/** Loads the small slice of Eva data the hero card needs (parent/child + unread + badges)
 *  once per session and shares it across pages so the hero can sit at the top of every
 *  route without each page re-fetching the same data. */
export function HeroDataProvider({ children }: { children: ReactNode }) {
  const { session, getEvaToken } = useAuth();
  const [state, setState] = useState<HeroData>(emptyState);

  useEffect(() => {
    if (!session) {
      setState(emptyState);
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    void (async () => {
      const token = await getEvaToken().catch(() => null);
      if (cancelled) return;
      if (!token) {
        setState({ ...emptyState, loading: false });
        return;
      }
      try {
        const parent = await fetchEvaParent(session.school, token);
        if (cancelled) return;
        const child = parent.children[0] ?? null;
        const studentId = child?.studentId;
        const orgId = child?.schools[0]?.orgId ?? session.orgId;

        /* Reveal the child as soon as we have it so the avatar + name render quickly. */
        setState((prev) => ({ ...prev, parentUserId: parent.userId, child }));

        const [unreadRes, badgesRes] = await Promise.allSettled([
          fetchEvaUnreadMessages(session.school, token, parent.userId, orgId),
          studentId
            ? fetchEvaBadgeCounts(session.school, token, parent.userId, orgId, studentId)
            : Promise.resolve<EvaBadgeCounts>({}),
        ]);
        if (cancelled) return;
        setState({
          parentUserId: parent.userId,
          child,
          unread: unreadRes.status === "fulfilled" ? (unreadRes.value ?? 0) : 0,
          badges: badgesRes.status === "fulfilled" ? badgesRes.value : {},
          loading: false,
        });
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken]);

  return <HeroDataContext.Provider value={state}>{children}</HeroDataContext.Provider>;
}

export function useHeroData(): HeroData {
  return useContext(HeroDataContext);
}
