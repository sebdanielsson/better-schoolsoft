import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHeroData } from "../hooks/useHeroData.tsx";
import {
  bootstrapSchoolsoftSession,
  fetchHolisticAssessments,
  type HolisticAssessmentRow,
} from "../api/schoolsoft.ts";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { cn } from "../lib/utils.ts";

export default function AssessmentsPage() {
  const { session, getEvaToken } = useAuth();
  const { parentUserId, child } = useHeroData();
  const [rows, setRows] = useState<HolisticAssessmentRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    if (!parentUserId || !child) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

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
        const data = await fetchHolisticAssessments(session.school);
        if (cancelled) return;
        setRows(data);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load assessments");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, getEvaToken, parentUserId, child]);

  const { unreadCount, publishedCount } = useMemo(() => {
    if (!rows) return { unreadCount: 0, publishedCount: 0 };
    let unread = 0;
    let published = 0;
    for (const r of rows) {
      if (r.published) {
        published++;
        if (!r.read) unread++;
      }
    }
    return { unreadCount: unread, publishedCount: published };
  }, [rows]);

  if (!session) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Assessments</h2>
        {rows && (
          <span className="text-[0.85rem] text-slate-500">
            {publishedCount} published
            {unreadCount > 0 && ` · ${unreadCount} unread`}
          </span>
        )}
      </div>

      {error && (
        <div className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <SkeletonList />
      ) : !rows || rows.length === 0 ? (
        <div className="py-12 px-8 text-center text-slate-500 bg-white rounded-lg border border-dashed border-slate-200">
          No assessments to display.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <AssessmentRow key={`${row.title}-${row.holisticAssessmentId}`} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AssessmentRow({ row }: { row: HolisticAssessmentRow }) {
  const isUnread = row.published && !row.read;
  const hasDetail = row.holisticAssessmentId > 0;
  const className = cn(
    "grid grid-cols-[6px_1fr_auto] items-center gap-3 rounded-lg border bg-white px-4 py-3 transition-colors",
    row.subjectWarning ? "border-amber-300 bg-amber-50" : "border-slate-200",
    hasDetail && "hover:border-slate-300 hover:shadow-sm",
  );
  const body = (
    <>
      <span
        aria-hidden="true"
        className="self-stretch rounded-full"
        style={{ background: row.color }}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[0.95rem]">{row.title}</span>
          {row.subjectWarning && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-amber-800">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Subject warning
            </span>
          )}
          {isUnread && (
            <span className="inline-block h-2 w-2 rounded-full bg-blue-600" aria-label="Unread" />
          )}
        </div>
        <div
          className={cn(
            "text-[0.85rem] mt-0.5",
            row.published ? "text-slate-700" : "text-slate-400 italic",
          )}
        >
          {row.subTitle}
        </div>
      </div>
      <div className="text-[0.78rem] text-slate-500 whitespace-nowrap">
        {row.friendlyUpdatedAt}
      </div>
    </>
  );
  return (
    <li>
      {hasDetail ? (
        <Link to={`/assessments/${row.holisticAssessmentId}`} className={cn(className, "no-underline text-inherit")}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}

function SkeletonList() {
  return (
    <ul className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="grid grid-cols-[6px_1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
        >
          <Skeleton className="self-stretch rounded-full" />
          <div className="min-w-0">
            <Skeleton className="h-4 w-32 rounded-sm" />
            <Skeleton className="h-3 w-48 rounded-sm mt-2" />
          </div>
          <Skeleton className="h-3 w-16 rounded-sm" />
        </li>
      ))}
    </ul>
  );
}
