import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, FileText, HandCoins, Link2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHeroData } from "../hooks/useHeroData.tsx";
import {
  bootstrapSchoolsoftSession,
  fetchAssignmentAssessment,
  fetchAssignmentConnectedPlannings,
  fetchAssignmentSections,
  fetchAssignmentSubmission,
  fetchAssignmentView,
  fetchMaterialFiles,
  type AssignmentAssessment,
  type AssignmentSection,
  type AssignmentSubmission,
  type AssignmentView,
  type ConnectedPlanning,
  type MaterialFile,
} from "../api/schoolsoft.ts";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { sanitizeStaffHtml } from "../lib/sanitize-html.ts";
import { cn } from "../lib/utils.ts";

interface State {
  view: AssignmentView | null;
  sections: AssignmentSection[];
  submission: AssignmentSubmission | null;
  assessment: AssignmentAssessment | null;
  plannings: ConnectedPlanning[];
  materialFiles: MaterialFile[];
}

const emptyState: State = {
  view: null,
  sections: [],
  submission: null,
  assessment: null,
  plannings: [],
  materialFiles: [],
};

export default function AssignmentDetailPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = idParam ? Number(idParam) : NaN;
  const { session, getEvaToken } = useAuth();
  const { parentUserId, child } = useHeroData();

  const [state, setState] = useState<State>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !parentUserId || !child) return;
    if (!Number.isFinite(id) || id <= 0) {
      setError("Invalid assignment id.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setState(emptyState);

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
        /* Fire view + sections + plannings + assessment in parallel. Submission
         * depends on sections (we need the section's id), so it fetches after. */
        const [viewRes, sectionsRes, planningsRes, assessmentRes] =
          await Promise.allSettled([
            fetchAssignmentView(session.school, id),
            fetchAssignmentSections(session.school, id),
            fetchAssignmentConnectedPlannings(session.school, id),
            fetchAssignmentAssessment(session.school, id),
          ]);
        if (cancelled) return;
        const sections =
          sectionsRes.status === "fulfilled" ? sectionsRes.value : [];
        const submissionSection = sections.find((s) => s.type === "SUBMISSION");
        const materialSections = sections.filter((s) => s.type === "MATERIAL");
        const [submissionRes2, ...materialResults] = await Promise.allSettled([
          submissionSection
            ? fetchAssignmentSubmission(session.school, submissionSection.id)
            : Promise.resolve(null),
          ...materialSections.map((m) => fetchMaterialFiles(session.school, m.id)),
        ]);
        if (cancelled) return;
        const submission =
          submissionRes2.status === "fulfilled" ? submissionRes2.value : null;
        const materialFiles = materialResults.flatMap((r) =>
          r.status === "fulfilled" ? r.value : [],
        );
        setState({
          view: viewRes.status === "fulfilled" ? viewRes.value : null,
          sections,
          submission,
          assessment:
            assessmentRes.status === "fulfilled" ? assessmentRes.value : null,
          plannings: planningsRes.status === "fulfilled" ? planningsRes.value : [],
          materialFiles,
        });
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load assignment");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, parentUserId, child, id]);

  const sanitizedDescription = useMemo(
    () => (state.view?.description ? sanitizeStaffHtml(state.view.description) : ""),
    [state.view?.description],
  );

  if (!session) return null;

  const hasSubmission = state.sections.some((s) => s.type === "SUBMISSION");
  const hasResult = state.sections.some((s) => s.type === "RESULTREPORT");

  return (
    <div>
      <nav className="text-[0.85rem] text-slate-500 mb-2">
        <Link to="/" className="hover:text-blue-600 transition-colors">
          Home
        </Link>
        <span className="mx-1.5 text-slate-300">/</span>
        <span className="text-slate-700">{state.view?.title ?? "Assignment"}</span>
      </nav>
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight">
          {loading && !state.view ? (
            <Skeleton className="h-8 w-2/3 rounded-sm" />
          ) : (
            state.view?.title ?? "Assignment"
          )}
        </h2>
        {state.view && (
          <p className="mt-1 text-[0.85rem] text-slate-500">
            {state.view.type} · {state.view.subjectNames}
            {state.view.subTitle ? ` · ${state.view.subTitle}` : ""}
          </p>
        )}
      </div>

      {error && (
        <div className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
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
              </section>
            )}
            {hasSubmission && state.submission && (
              <SubmissionPanel submission={state.submission} />
            )}
            {hasResult && state.assessment && (
              <ResultPanel assessment={state.assessment} />
            )}
            {state.materialFiles.length > 0 && (
              <section className="rounded-lg border border-slate-200 bg-white px-5 py-4">
                <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] mb-2">
                  Materials
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {state.materialFiles.map((f) => (
                    <li
                      key={f.fileId}
                      className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-[0.9rem]"
                    >
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{f.fileName.trim()}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[0.78rem] text-slate-500">
                  Open in SchoolSoft to download.
                </p>
              </section>
            )}
          </div>
          <aside className="md:col-span-1 flex flex-col gap-4">
            {state.plannings.length > 0 && (
              <section className="rounded-lg border border-slate-200 bg-white px-5 py-4">
                <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] mb-2">
                  Linked plannings
                </h3>
                <ul className="flex flex-col gap-2">
                  {state.plannings.map((p) => (
                    <li key={p.id}>
                      <Link
                        to={p.planningId ? `/plannings/${p.planningId}/${p.id}` : "#"}
                        className="block rounded-md border border-slate-200 px-3 py-2 text-inherit no-underline transition-colors hover:border-slate-300 hover:shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="text-[0.92rem] font-semibold">{p.title}</span>
                        </div>
                        <div className="mt-0.5 text-[0.78rem] text-slate-500">
                          {p.subTitle}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function SubmissionPanel({ submission }: { submission: AssignmentSubmission }) {
  const { submitted } = submission.submissionStatus;
  const expireDate = submission.expireDate;
  const expired = expireDate ? Date.now() > new Date(expireDate).getTime() : false;
  const past = expired && !submitted;

  let label: string;
  let icon: React.ReactNode;
  let toneClass: string;
  if (submitted) {
    label = "Submitted";
    icon = <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />;
    toneClass = "border-slate-200 bg-white";
  } else if (past) {
    label = "Past due, not submitted";
    icon = <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />;
    toneClass = "border-red-200 bg-red-50";
  } else {
    label = "Not submitted";
    icon = <FileText className="h-5 w-5 text-slate-500" aria-hidden="true" />;
    toneClass = "border-slate-200 bg-white";
  }

  return (
    <section className={cn("rounded-lg border px-5 py-4", toneClass)}>
      <div className="flex items-start gap-3 mb-2">
        {icon}
        <div className="min-w-0">
          <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em]">{label}</h3>
          {submission.expireDate && (
            <p className="text-[0.85rem] text-slate-600 mt-0.5">
              Due {formatDateTime(submission.expireDate)}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[0.85rem] text-slate-600">
        <HandCoins className="h-4 w-4 shrink-0" aria-hidden="true" />
        {submission.handInType === "PHYSICAL"
          ? "Hand in directly to the teacher"
          : "Digital submission"}
      </div>
    </section>
  );
}

function ResultPanel({ assessment }: { assessment: AssignmentAssessment }) {
  if (!assessment.review && !assessment.teacherComment && !assessment.studentComment) {
    return null;
  }
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-5 py-4">
      <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] mb-2">Result</h3>
      {assessment.review && (
        <p className="text-[0.95rem] text-slate-800">{assessment.review}</p>
      )}
      {assessment.teacherComment && (
        <div className="mt-3 rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Teacher comment
          </p>
          <p className="text-[0.9rem] text-slate-800 mt-0.5">{assessment.teacherComment}</p>
        </div>
      )}
    </section>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
