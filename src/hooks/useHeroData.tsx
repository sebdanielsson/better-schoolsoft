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
  /** The child in focus, or null while loading / for non-guardian users. */
  child: EvaChild | null;
  /** Every child on the guardian's account. */
  children: EvaChild[];
  /** Switch the child in focus. Persisted per browser. */
  selectChild: (studentId: number) => void;
  unread: number;
  badges: EvaBadgeCounts;
  /** True while the parent + unread + badges fetches are in flight. */
  loading: boolean;
}

type LoadedState = Omit<HeroData, "selectChild">;

const emptyState: LoadedState = {
  parentUserId: null,
  child: null,
  children: [],
  unread: 0,
  badges: {},
  loading: true,
};

const HeroDataContext = createContext<HeroData>({ ...emptyState, selectChild: () => {} });

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
        const studentId = child?.studentId;
        const orgId = child?.schools[0]?.orgId ?? session.orgId;

        /* Reveal the child as soon as we have it so the avatar + name render quickly. */
        setState((prev) => ({
          ...prev,
          parentUserId: parent.userId,
          child,
          children: parent.children,
        }));

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
          children: parent.children,
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
  }, [session, getEvaToken, selected]);

  const value = useMemo(() => ({ ...state, selectChild }), [state, selectChild]);
  return <HeroDataContext.Provider value={value}>{children}</HeroDataContext.Provider>;
}

export function useHeroData(): HeroData {
  return useContext(HeroDataContext);
}
