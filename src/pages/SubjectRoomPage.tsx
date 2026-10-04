import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Award, CalendarRange, ChevronDown } from "lucide-react";
import { useSchoolsoftContext, type SchoolsoftContext } from "../hooks/useSchoolsoftContext.tsx";
import { useQuery } from "../hooks/useQuery.ts";
import {
  fetchSubjectRoom,
  fetchSubjectRoomAssignments,
  fetchSubjectRoomInformation,
  fetchSubjectRoomPlannings,
  fetchSubjectRoomResults,
  fetchSubjectRoomTeachers,
  fetchSubjectRooms,
  type SubjectRoom,
  type SubjectRoomAssignmentRow,
} from "../api/schoolsoft.ts";
import {
  assignmentWhen,
  formatRoomDate,
  partitionAssignments,
  safeHexColor,
  sortPlannings,
  sortResults,
  subjectRoomKeys,
} from "../lib/subject-rooms.ts";
import StaffHtml from "../components/StaffHtml.tsx";
import { SubmissionIcon } from "../components/AssignmentsCard.tsx";
import DashCard, { DashCardEmpty, ErrorBanner, UnreadDot } from "../components/DashCard.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.tsx";
import { cn } from "../lib/utils.ts";

const PAST_PREVIEW = 5;

const rowClass =
  "grid grid-cols-[auto_1fr] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-inherit no-underline transition-colors hover:border-slate-300 hover:shadow-sm";
const rowTitleClass = "truncate text-[0.92rem] font-semibold";
const rowMetaClass = "truncate text-[0.78rem] text-slate-500";

/** Wraps a fetcher so it first ensures the cookie session `/rest-api` needs. */
function withSession<T>(ctx: SchoolsoftContext | null, fn: (ctx: SchoolsoftContext) => Promise<T>) {
  return () => ctx!.withCookies(() => fn(ctx!));
}

export default function SubjectRoomPage() {
  const { activityId: param } = useParams<{ activityId: string }>();
  const id = Number(param);
  const valid = Number.isInteger(id) && id > 0;
  const ctx = useSchoolsoftContext();
  const c = valid ? ctx : null;

  const room = useQuery(
    c && subjectRoomKeys.room(c, id),
    withSession(c, (x) => fetchSubjectRoom(x.school, id)),
  );
  const teachers = useQuery(
    c && subjectRoomKeys.teachers(c, id),
    withSession(c, (x) => fetchSubjectRoomTeachers(x.school, id)),
  );
  const assignments = useQuery(
    c && subjectRoomKeys.assignments(c, id),
    withSession(c, (x) => fetchSubjectRoomAssignments(x.school, id)),
  );
  const results = useQuery(
    c && subjectRoomKeys.results(c, id),
    withSession(c, (x) => fetchSubjectRoomResults(x.school, id)),
  );
  const plannings = useQuery(
    c && subjectRoomKeys.plannings(c, id),
    withSession(c, (x) => fetchSubjectRoomPlannings(x.school, id)),
  );
  /* Same key as the Subjects page, so the picker is usually a cache hit. */
  const rooms = useQuery(
    c && subjectRoomKeys.all(c),
    withSession(c, (x) => fetchSubjectRooms(x.school)),
  );
  const information = useQuery(
    c && subjectRoomKeys.information(c, id),
    withSession(c, (x) => fetchSubjectRoomInformation(x.school, id)),
  );

  if (!valid) {
    return <ErrorBanner>That subject link is not valid.</ErrorBanner>;
  }

  const { upcoming, past } = assignments.data
    ? partitionAssignments(assignments.data)
    : { upcoming: [], past: [] };
  const color = safeHexColor(room.data?.color);

  return (
    <div>
      <div className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1.5 rounded-full" style={{ background: color }} />
        <div className="min-w-0">
          {room.data ? (
            <SubjectPicker current={id} title={room.data.subject} rooms={rooms.data} />
          ) : (
            <Skeleton className="h-7 w-48 rounded-md" />
          )}
          <div className="mt-0.5 text-[0.85rem] text-slate-500">
            {room.data?.groupNames.join(", ")}
            {teachers.data && teachers.data.length > 0 && (
              <>
                {" · "}
                {teachers.data.map((t) => `${t.firstName} ${t.lastName}`).join(", ")}
              </>
            )}
          </div>
        </div>
      </div>

      {room.error && <ErrorBanner>{room.error.message}</ErrorBanner>}

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-12">
        <DashCard
          title="Upcoming"
          accent="rose"
          className="md:col-span-6"
          action={<Count n={assignments.data ? upcoming.length : undefined} />}
        >
          {assignments.error && <ErrorBanner>{assignments.error.message}</ErrorBanner>}
          {assignments.loading ? (
            <RowSkeletons />
          ) : upcoming.length === 0 ? (
            <DashCardEmpty>Nothing upcoming in this subject.</DashCardEmpty>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {upcoming.map((a) => (
                <AssignmentItem key={a.assignmentId} row={a} />
              ))}
            </ul>
          )}
        </DashCard>

        <DashCard
          title="Results"
          accent="green"
          className="md:col-span-6"
          action={<Count n={results.data?.length} />}
        >
          {results.error && <ErrorBanner>{results.error.message}</ErrorBanner>}
          {results.loading ? (
            <RowSkeletons />
          ) : !results.data || results.data.length === 0 ? (
            <DashCardEmpty>No results published yet.</DashCardEmpty>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {sortResults(results.data).map((r) => (
                <li key={r.assignmentId}>
                  <Link to={`/assignments/${r.assignmentId}`} className={rowClass}>
                    <Award className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={rowTitleClass}>{r.title}</span>
                        {!r.read && <UnreadDot />}
                      </div>
                      <div className={rowMetaClass}>
                        {r.assignmentType} · published {formatRoomDate(r.publishDate, false)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashCard>

        <DashCard
          title="Plannings"
          accent="purple"
          className="md:col-span-6"
          action={<Count n={plannings.data?.length} />}
        >
          {plannings.error && <ErrorBanner>{plannings.error.message}</ErrorBanner>}
          {plannings.loading ? (
            <RowSkeletons />
          ) : !plannings.data || plannings.data.length === 0 ? (
            <DashCardEmpty>No plannings in this subject.</DashCardEmpty>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {sortPlannings(plannings.data).map((p) => {
                const finished = p.status === "EXPIRED";
                return (
                  <li key={p.planningPartId}>
                    <Link
                      to={`/plannings/${p.planningId}/${p.planningPartId}`}
                      className={cn(rowClass, finished && "opacity-70")}
                    >
                      <CalendarRange
                        className={cn(
                          "h-4 w-4 shrink-0",
                          finished ? "text-slate-400" : "text-violet-600",
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={rowTitleClass}>
                            {p.planningPartTitle.trim() || p.planningTitle.trim() || "Planning"}
                          </span>
                          {!p.read && <UnreadDot />}
                        </div>
                        <div className={rowMetaClass}>
                          {formatRoomDate(p.startDate, false)} – {formatRoomDate(p.endDate, false)}
                          {p.teacher ? ` · ${p.teacher}` : ""}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </DashCard>

        <InformationCard
          loading={information.loading}
          error={information.error}
          items={information.data ?? []}
        />

        <PastCard key={id} rows={past} loading={assignments.loading} />
      </div>
    </div>
  );
}

function AssignmentItem({ row }: { row: SubjectRoomAssignmentRow }) {
  return (
    <li>
      <Link to={`/assignments/${row.assignmentId}`} className={rowClass}>
        <SubmissionIcon status={row.submissionStatus} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={rowTitleClass}>{row.title}</span>
            {!row.read && <UnreadDot />}
          </div>
          <div className={rowMetaClass}>
            {row.assignmentType} · {assignmentWhen(row)}
            {row.resultReportStatus === "REPORTED" && " · result available"}
          </div>
        </div>
      </Link>
    </li>
  );
}

function InformationCard({
  loading,
  error,
  items,
}: {
  loading: boolean;
  error: Error | undefined;
  items: { id: number; information: string; createdBy: string; updatedAt: string }[];
}) {
  return (
    <DashCard title="From the teacher" accent="cool" className="md:col-span-6">
      {error && <ErrorBanner>{error.message}</ErrorBanner>}
      {loading ? (
        <RowSkeletons count={2} />
      ) : items.length === 0 ? (
        <DashCardEmpty>The teacher hasn't posted any information.</DashCardEmpty>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((info) => (
            <article key={info.id}>
              <StaffHtml html={info.information} className="text-[0.92rem]" />
              <div className="mt-2 text-[0.78rem] text-slate-500">
                {info.createdBy} · {info.updatedAt}
              </div>
            </article>
          ))}
        </div>
      )}
    </DashCard>
  );
}

function PastCard({ rows, loading }: { rows: SubjectRoomAssignmentRow[]; loading: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, PAST_PREVIEW);
  return (
    <DashCard
      title="Past assignments"
      accent="warm"
      className="md:col-span-12"
      action={<Count n={loading ? undefined : rows.length} />}
    >
      {loading ? (
        <RowSkeletons count={3} />
      ) : rows.length === 0 ? (
        <DashCardEmpty>No past assignments.</DashCardEmpty>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
            {shown.map((a) => (
              <AssignmentItem key={a.assignmentId} row={a} />
            ))}
          </ul>
          {rows.length > PAST_PREVIEW && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 text-xs font-medium text-slate-500 transition-colors hover:text-blue-600"
            >
              {expanded ? "Show fewer" : `Show all ${rows.length}`}
            </button>
          )}
        </>
      )}
    </DashCard>
  );
}

function Count({ n }: { n: number | undefined }) {
  if (n === undefined) return null;
  return <span className="text-xs font-semibold text-slate-500 tabular-nums">{n}</span>;
}

function RowSkeletons({ count = 3 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-1.5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
          <Skeleton className="h-4 w-40 rounded-sm" />
          <Skeleton className="mt-1.5 h-3 w-56 rounded-sm" />
        </li>
      ))}
    </ul>
  );
}

/** The subject title doubles as a switcher, so moving between subjects
 *  doesn't need a trip back to the list. Falls back to a plain heading
 *  until the list is in. */
function SubjectPicker({
  current,
  title,
  rooms,
}: {
  current: number;
  title: string;
  rooms: SubjectRoom[] | undefined;
}) {
  const navigate = useNavigate();
  const visible = rooms
    ?.filter((r) => r.isSubjectRoom && !r.hiddenForStudents)
    .sort((a, b) => a.subject.localeCompare(b.subject));
  if (!visible || visible.length < 2) {
    return <h2 className="text-2xl font-bold tracking-tight">{title}</h2>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="-mx-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 text-left transition-colors hover:bg-slate-100 data-popup-open:bg-slate-100"
        aria-label={`${title}, switch subject`}
      >
        <h2 className="truncate text-2xl font-bold tracking-tight">{title}</h2>
        <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[420px] w-[280px] overflow-y-auto">
        <DropdownMenuRadioGroup
          value={String(current)}
          onValueChange={(value) => {
            if (value !== String(current)) void navigate(`/subjects/${String(value)}`);
          }}
        >
          {visible.map((r) => (
            <DropdownMenuRadioItem
              key={r.activityId}
              value={String(r.activityId)}
              /* Subject names carry case; override the menu's uppercase default. */
              className="text-[0.88rem] font-normal tracking-normal normal-case"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: safeHexColor(r.color) }}
              />
              <span className="truncate">{r.subject}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
