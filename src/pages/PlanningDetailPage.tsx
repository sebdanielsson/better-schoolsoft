import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FileText, Link2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHeroData } from "../hooks/useHeroData.tsx";
import {
  bootstrapSchoolsoftSession,
  fetchPlanningConnectedAssignments,
  fetchPlanningPartView,
  fetchPlanningTabs,
  fetchPlanningView,
  type ConnectedAssignment,
  type PlanningPartTab,
  type PlanningPartView,
  type PlanningView,
} from "../api/schoolsoft.ts";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { sanitizeStaffHtml } from "../lib/sanitize-html.ts";
import { cn } from "../lib/utils.ts";

interface State {
  view: PlanningView | null;
  tabs: PlanningPartTab[];
  partView: PlanningPartView | null;
  assignments: ConnectedAssignment[];
}

const emptyState: State = {
  view: null,
  tabs: [],
  partView: null,
  assignments: [],
};

export default function PlanningDetailPage() {
  const { planningId: planningIdParam, partId: partIdParam } =
    useParams<{ planningId: string; partId: string }>();
  const planningId = planningIdParam ? Number(planningIdParam) : NaN;
  const initialPartId = partIdParam ? Number(partIdParam) : NaN;
  const [activePartId, setActivePartId] = useState<number>(initialPartId);

  const { session, getEvaToken } = useAuth();
  const { parentUserId, child } = useHeroData();

  const [state, setState] = useState<State>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !parentUserId || !child) return;
    if (!Number.isFinite(planningId) || !Number.isFinite(activePartId)) {
      setError("Invalid planning id.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const token = await getEvaToken();
        if (!token) throw new Error("No access token");
        const orgId = child.schools[0]?.orgId ?? session.orgId;
        await bootstrapSchoolsoftSession(
          session.school,
          token,
          parentUserId,
          orgId,
          child.studentId,
        );
        const [viewRes, tabsRes, partRes, assignmentsRes] = await Promise.allSettled([
          fetchPlanningView(session.school, planningId),
          fetchPlanningTabs(session.school, planningId),
          fetchPlanningPartView(session.school, activePartId),
          fetchPlanningConnectedAssignments(session.school, activePartId),
        ]);
        if (cancelled) return;
        setState({
          view: viewRes.status === "fulfilled" ? viewRes.value : null,
          tabs: tabsRes.status === "fulfilled" ? tabsRes.value : [],
          partView: partRes.status === "fulfilled" ? partRes.value : null,
          assignments:
            assignmentsRes.status === "fulfilled" ? assignmentsRes.value : [],
        });
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load planning");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, parentUserId, child, planningId, activePartId]);

  const sanitizedDescription = useMemo(
    () =>
      state.partView?.description ? sanitizeStaffHtml(state.partView.description) : "",
    [state.partView?.description],
  );

  if (!session) return null;

  return (
    <div>
      <nav className="text-[0.85rem] text-slate-500 mb-2">
        <Link to="/" className="hover:text-blue-600 transition-colors">
          Home
        </Link>
        <span className="mx-1.5 text-slate-300">/</span>
        <span className="text-slate-700">
          {state.view?.title ?? state.partView?.title ?? "Planning"}
        </span>
      </nav>
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight">
          {loading && !state.view ? (
            <Skeleton className="h-8 w-2/3 rounded-sm" />
          ) : (
            state.view?.title ?? state.partView?.title ?? "Planning"
          )}
        </h2>
        {(state.view || state.partView) && (
          <p className="mt-1 text-[0.85rem] text-slate-500">
            {state.view?.subjectNames ?? ""}
            {state.partView?.subtitle ? ` · ${state.partView.subtitle}` : ""}
          </p>
        )}
      </div>

      {state.tabs.length > 1 && (
        <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
          {state.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePartId(tab.id)}
              className={cn(
                "px-3 py-2 text-[0.85rem] font-medium border-b-2 transition-colors whitespace-nowrap",
                tab.id === activePartId
                  ? "border-indigo-500 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              {tab.title}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 flex flex-col gap-4">
            {sanitizedDescription && (
              <section className="rounded-lg border border-slate-200 bg-white px-5 py-4">
                <div
                  className="text-[0.95rem] leading-[1.55] text-slate-800 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_a]:text-blue-600 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
                />
                {state.partView?.publishDate && (
                  <p className="text-[0.78rem] text-slate-500 mt-3">
                    Published {state.partView.publishDate}
                  </p>
                )}
              </section>
            )}
          </div>
          <aside className="md:col-span-1 flex flex-col gap-4">
            {state.assignments.length > 0 && (
              <section className="rounded-lg border border-slate-200 bg-white px-5 py-4">
                <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] mb-2">
                  Linked assignments
                </h3>
                <ul className="flex flex-col gap-2">
                  {state.assignments.map((a) => (
                    <li key={a.id}>
                      <Link
                        to={`/assignments/${a.id}`}
                        className="block rounded-md border border-slate-200 px-3 py-2 text-inherit no-underline transition-colors hover:border-slate-300 hover:shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="text-[0.92rem] font-semibold">{a.title}</span>
                          {!a.read && (
                            <span
                              className="inline-block h-2 w-2 rounded-full bg-blue-600 shrink-0"
                              aria-label="Unread"
                            />
                          )}
                        </div>
                        <div className="mt-0.5 text-[0.78rem] text-slate-500">
                          {a.subTitle}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {state.assignments.length === 0 && !loading && (
              <section className="rounded-lg border border-dashed border-slate-200 px-5 py-4 text-[0.85rem] text-slate-500">
                <Link2 className="h-4 w-4 inline mr-1.5 align-text-bottom" aria-hidden="true" />
                No linked assignments.
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
