import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./useAuth.tsx";
import { invalidateQueries } from "../lib/query-cache.ts";
import { NOTIFICATIONS_KEY } from "../lib/notifications.ts";
import { fetchEvaParent, type EvaChild } from "../api/schoolsoft.ts";

export interface HeroData {
  /** Parent's userId (resolved from the Eva /parent endpoint). */
  parentUserId: number | null;
  /** The child in focus, or null while loading / for non-guardian users. */
  child: EvaChild | null;
  /** Every child on the guardian's account. */
  children: EvaChild[];
  /** Switch the child in focus. Persisted per browser. */
  selectChild: (studentId: number) => void;
  /** Refresh the unread items (notification center, section badges) after
   *  something was marked read or unread elsewhere in the app. */
  refreshCounts: () => void;
  /** True while the parent/children fetch is in flight. */
  loading: boolean;
}

type LoadedState = Omit<HeroData, "selectChild" | "refreshCounts">;

const emptyState: LoadedState = {
  parentUserId: null,
  child: null,
  children: [],
  loading: true,
};

const HeroDataContext = createContext<HeroData>({
  ...emptyState,
  selectChild: () => {},
  refreshCounts: () => {},
});

const CHILD_KEY = "bss_child";

function readSelectedChild(): number | null {
  try {
    const v = Number(localStorage.getItem(CHILD_KEY));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Loads the small slice of Eva data the hero card needs (parent/child + unread + badges)
 *  once per session and shares it across pages so the hero can sit at the top of every
 *  route without each page re-fetching the same data. */
export function HeroDataProvider({ children }: { children: ReactNode }) {
  const { session, getEvaToken } = useAuth();
  const [state, setState] = useState<LoadedState>(emptyState);
  const [selected, setSelected] = useState<number | null>(readSelectedChild);

  const selectChild = useCallback((studentId: number) => {
    try {
      localStorage.setItem(CHILD_KEY, String(studentId));
    } catch {
      /* private mode: selection just won't persist */
    }
    setSelected(studentId);
    /* Switch immediately from the list we already have instead of showing the
     * previous child until /parent comes back. Everything child-scoped is
     * keyed by studentId, so the new child's data loads on its own. */
    setState((prev) => {
      const next = prev.children.find((c) => c.studentId === studentId);
      if (!next || next.studentId === prev.child?.studentId) return prev;
      return { ...prev, child: next };
    });
  }, []);

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
        const child =
          parent.children.find((c) => c.studentId === selected) ?? parent.children[0] ?? null;
        setState({
          parentUserId: parent.userId,
          child,
          children: parent.children,
          loading: false,
        });
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, selected]);

  /* Unread counts now come from the notification center's queries (one
   * source for the hero pill, section badges and the panel), so a refresh is
   * just an invalidation of those. */
  const refreshCounts = useCallback(() => {
    invalidateQueries(NOTIFICATIONS_KEY);
  }, []);

  const value = useMemo(
    () => ({ ...state, selectChild, refreshCounts }),
    [state, selectChild, refreshCounts],
  );
  return <HeroDataContext.Provider value={value}>{children}</HeroDataContext.Provider>;
}

export function useHeroData(): HeroData {
  return useContext(HeroDataContext);
}

/** Org of the child in focus, falling back to the session's own org (non-
 *  guardian logins). Anything that shows school-specific data (lunch, staff,
 *  school parameters) must use this, not `session.orgId`: siblings can attend
 *  different schools. */
export function useChildOrgId(): number | null {
  const { session } = useAuth();
  const { child } = useHeroData();
  return child?.schools[0]?.orgId ?? session?.orgId ?? null;
}
