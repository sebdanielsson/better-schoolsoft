import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHeroData } from "../hooks/useHeroData.tsx";
import {
  bootstrapSchoolsoftSession,
  confirmHolisticAssessmentSubjectWarning,
  fetchHolisticAssessmentConfirmStatus,
  fetchHolisticAssessmentDetail,
  fetchHolisticAssessmentKnowledgeDevelopment,
  fetchHolisticAssessmentSections,
  fetchHolisticAssessmentSubjectWarning,
  type HolisticAssessmentConfirmStatus,
  type HolisticAssessmentDetail,
  type HolisticAssessmentKnowledgeDevelopment,
  type HolisticAssessmentSection,
  type HolisticAssessmentSubjectWarning,
} from "../api/schoolsoft.ts";
import { Button } from "../components/ui/button.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";

interface DetailState {
  detail: HolisticAssessmentDetail | null;
  warning: HolisticAssessmentSubjectWarning | null;
  confirmStatus: HolisticAssessmentConfirmStatus | null;
  knowledge: HolisticAssessmentKnowledgeDevelopment | null;
  sections: HolisticAssessmentSection[];
}

const emptyState: DetailState = {
  detail: null,
  warning: null,
  confirmStatus: null,
  knowledge: null,
  sections: [],
};

export default function AssessmentDetailPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = idParam ? Number(idParam) : NaN;
  const { session, getEvaToken } = useAuth();
  const { parentUserId, child } = useHeroData();

  const [state, setState] = useState<DetailState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !parentUserId || !child) return;
    if (!Number.isFinite(id) || id <= 0) {
      setError("Invalid assessment id.");
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
        if (!token) throw new Error("No access token available");
        const orgId = child.schools[0]?.orgId ?? session.orgId;
        await bootstrapSchoolsoftSession(
          session.school,
          token,
          parentUserId,
          orgId,
          child.studentId,
        );
        const [detailRes, warningRes, confirmRes, knowledgeRes, sectionsRes] =
          await Promise.allSettled([
            fetchHolisticAssessmentDetail(session.school, id),
            fetchHolisticAssessmentSubjectWarning(session.school, id),
            fetchHolisticAssessmentConfirmStatus(session.school, id),
            fetchHolisticAssessmentKnowledgeDevelopment(session.school, id),
            fetchHolisticAssessmentSections(session.school, id),
          ]);
        if (cancelled) return;
        setState({
          detail: detailRes.status === "fulfilled" ? detailRes.value : null,
          warning: warningRes.status === "fulfilled" ? warningRes.value : null,
          confirmStatus: confirmRes.status === "fulfilled" ? confirmRes.value : null,
          knowledge: knowledgeRes.status === "fulfilled" ? knowledgeRes.value : null,
          sections: sectionsRes.status === "fulfilled" ? sectionsRes.value : [],
        });
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load assessment");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, parentUserId, child, id]);

  const onConfirm = useCallback(async () => {
    if (!session || confirming) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      await confirmHolisticAssessmentSubjectWarning(session.school, id);
      /* Refetch confirm status — the POST returns no body, so a follow-up GET
       * gives us the authoritative `confirmedAt` + `name` stamp to render. */
      const fresh = await fetchHolisticAssessmentConfirmStatus(session.school, id);
      setState((prev) => ({ ...prev, confirmStatus: fresh }));
    } catch (e: unknown) {
      setConfirmError(e instanceof Error ? e.message : "Failed to confirm");
    } finally {
      setConfirming(false);
    }
  }, [session, id, confirming]);

  if (!session) return null;

  const subjectName = state.detail?.activityName ?? "";
  const showWarning = state.sections.includes("SUBJECT_WARNING") && state.warning?.published;
  const showKnowledge = state.sections.includes("KNOWLEDGE_DEVELOPMENT") && state.knowledge;

  return (
    <div>
      <nav className="text-[0.85rem] text-slate-500 mb-2">
        <Link to="/assessments" className="hover:text-blue-600 transition-colors">
          Assessments
        </Link>
        {subjectName && (
          <>
            <span className="mx-1.5 text-slate-300">/</span>
            <span className="text-slate-700">{subjectName}</span>
          </>
        )}
      </nav>
      <h2 className="text-2xl font-bold tracking-tight mb-5">
        {loading && !state.detail ? (
          <Skeleton className="h-8 w-64 rounded-sm" />
        ) : (
          subjectName || "Assessment"
        )}
      </h2>

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
        <div className="flex flex-col gap-4">
          {showWarning && state.warning && (
            <SubjectWarningCard
              warning={state.warning}
              confirmStatus={state.confirmStatus}
              onConfirm={onConfirm}
              confirming={confirming}
              confirmError={confirmError}
            />
          )}
          {showKnowledge && state.knowledge && (
            <KnowledgeDevelopmentCard knowledge={state.knowledge} />
          )}
          {!showWarning && !showKnowledge && (
            <div className="py-12 px-8 text-center text-slate-500 bg-white rounded-lg border border-dashed border-slate-200">
              No assessment details published yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubjectWarningCard({
  warning,
  confirmStatus,
  onConfirm,
  confirming,
  confirmError,
}: {
  warning: HolisticAssessmentSubjectWarning;
  confirmStatus: HolisticAssessmentConfirmStatus | null;
  onConfirm: () => void;
  confirming: boolean;
  confirmError: string | null;
}) {
  const hasConfirmed = confirmStatus?.hasConfirmed ?? false;
  return (
    <section
      className={
        hasConfirmed
          ? "rounded-lg border border-slate-200 bg-white px-5 py-4"
          : "rounded-lg border border-red-200 bg-red-50 px-5 py-4"
      }
    >
      <div className="flex items-start gap-3 mb-3">
        {hasConfirmed ? (
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em]">
            {hasConfirmed ? "Subject warning acknowledged" : "Subject warning"}
          </h3>
          <p className="text-[0.78rem] text-slate-500 mt-0.5">
            Published {warning.publishedAt} by {warning.lastUpdatedBy}
          </p>
        </div>
      </div>
      <p className="text-[0.92rem] leading-[1.5] whitespace-pre-wrap text-slate-800">
        {warning.comment}
      </p>
      {hasConfirmed ? (
        <p className="text-[0.85rem] text-slate-600 mt-3">
          Acknowledged {confirmStatus?.confirmedAt}
          {confirmStatus?.name ? ` by ${confirmStatus.name}` : ""}.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.85rem] text-slate-600">
            Confirm that you have read this warning.
          </p>
          <div className="flex flex-col items-end gap-1">
            <Button
              onClick={onConfirm}
              disabled={confirming}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {confirming ? "Confirming…" : "I confirm I have read this"}
            </Button>
            {confirmError && (
              <span className="text-[0.78rem] text-red-700">{confirmError}</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function KnowledgeDevelopmentCard({
  knowledge,
}: {
  knowledge: HolisticAssessmentKnowledgeDevelopment;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-5 py-4">
      <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] mb-2">
        Knowledge development
      </h3>
      <p className="text-[0.95rem] text-slate-800">{knowledge.value}</p>
      {knowledge.supportMeasures && (
        <div className="mt-3 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-[0.85rem] text-slate-700">
          <span className="font-semibold">Support measures: </span>
          {knowledge.supportMeasures}
        </div>
      )}
      <p className="text-[0.78rem] text-slate-500 mt-3">{knowledge.updatedByInfo}</p>
    </section>
  );
}
