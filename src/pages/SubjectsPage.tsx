import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useSchoolsoftContext, type SchoolsoftContext } from "../hooks/useSchoolsoftContext.tsx";
import { useQuery } from "../hooks/useQuery.ts";
import {
  fetchSubjectRoomAssignments,
  fetchSubjectRoomTeachers,
  fetchSubjectRooms,
  type SubjectRoom,
} from "../api/schoolsoft.ts";
import { schedule } from "../lib/fetch-scheduler.ts";
import {
  assignmentWhen,
  partitionAssignments,
  safeHexColor,
  subjectRoomKeys,
} from "../lib/subject-rooms.ts";
import { ErrorBanner, UnreadDot } from "../components/DashCard.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";

export default function SubjectsPage() {
  const ctx = useSchoolsoftContext();
  const rooms = useQuery(ctx && subjectRoomKeys.all(ctx), () =>
    ctx!.withCookies(() => fetchSubjectRooms(ctx!.school)),
  );

  const visible = rooms.data
    ?.filter((r) => r.isSubjectRoom && !r.hiddenForStudents)
    .sort((a, b) => a.subject.localeCompare(b.subject));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Subjects</h2>
        {visible && (
          <span className="text-[0.85rem] text-slate-500">{visible.length} subjects</span>
        )}
      </div>

      {rooms.error && <ErrorBanner>{rooms.error.message}</ErrorBanner>}

      {!ctx || rooms.loading ? (
        <SkeletonGrid />
      ) : !visible || visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-8 py-12 text-center text-slate-500">
          No subjects to display.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((room) => (
            <SubjectCard key={room.activityId} ctx={ctx} room={room} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SubjectCard({ ctx, room }: { ctx: SchoolsoftContext; room: SubjectRoom }) {
  const id = room.activityId;
  /* Per-card enrichment goes through the shared scheduler so 17 subjects × 2
   * requests don't monopolise the connection pool. */
  const teachers = useQuery(subjectRoomKeys.teachers(ctx, id), () =>
    schedule("high", () => ctx.withCookies(() => fetchSubjectRoomTeachers(ctx.school, id))),
  );
  const assignments = useQuery(subjectRoomKeys.assignments(ctx, id), () =>
    schedule("high", () => ctx.withCookies(() => fetchSubjectRoomAssignments(ctx.school, id))),
  );

  const next = assignments.data ? partitionAssignments(assignments.data).upcoming[0] : undefined;
  const unread = assignments.data?.filter((a) => !a.read).length ?? 0;
  const teacherNames = teachers.data?.map((t) => `${t.firstName} ${t.lastName}`).join(", ");

  return (
    <li>
      <Link
        to={`/subjects/${id}`}
        className="grid h-full grid-cols-[6px_1fr_auto] items-stretch gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-inherit no-underline transition-colors hover:border-slate-300 hover:shadow-sm"
      >
        <span
          aria-hidden="true"
          className="rounded-full"
          style={{ background: safeHexColor(room.color) }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[0.95rem] font-semibold">{room.subject}</span>
            {unread > 0 && <UnreadDot />}
          </div>
          <div className="truncate text-[0.8rem] text-slate-500">
            {room.groupNames.join(", ")}
            {teacherNames ? ` · ${teacherNames}` : ""}
          </div>
          <div className="mt-1.5 truncate text-[0.8rem] text-slate-700">
            {assignments.loading ? (
              <Skeleton className="h-3 w-40 rounded-sm" />
            ) : next ? (
              <>
                <span className="font-medium">Next:</span> {next.title}
                <span className="text-slate-500"> · {assignmentWhen(next)}</span>
              </>
            ) : (
              <span className="text-slate-400">Nothing upcoming</span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 self-center text-slate-400" aria-hidden="true" />
      </Link>
    </li>
  );
}

function SkeletonGrid() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 9 }).map((_, i) => (
        <li
          key={i}
          className="grid grid-cols-[6px_1fr] gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
        >
          <Skeleton className="rounded-full" />
          <div>
            <Skeleton className="h-4 w-32 rounded-sm" />
            <Skeleton className="mt-2 h-3 w-48 rounded-sm" />
            <Skeleton className="mt-2 h-3 w-40 rounded-sm" />
          </div>
        </li>
      ))}
    </ul>
  );
}
