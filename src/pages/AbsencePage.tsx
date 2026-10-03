import { useState } from "react";
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { useSchoolsoftContext, type SchoolsoftContext } from "../hooks/useSchoolsoftContext.tsx";
import { useQuery } from "../hooks/useQuery.ts";
import { useNow } from "../hooks/useNow.ts";
import {
  fetchEvaAbsenceDay,
  fetchEvaAbsencePermissions,
  fetchEvaAbsenceWeek,
  isoWeek,
  isoWeekYear,
  saveEvaAbsenceLessonComment,
  saveEvaAbsenceWeekComment,
  setEvaFullDayAbsence,
  setEvaLessonAbsence,
  type AbsenceDay,
  type AbsenceLesson,
  type AbsencePermissions,
} from "../api/schoolsoft.ts";
import {
  absenceKeys,
  addDays,
  canReportFullDay,
  canReportLesson,
  canWithdrawLesson,
  lessonAttendance,
  lessonEnded,
  mondayOf,
  schoolMidnightMs,
  schoolYearWeeks,
  type AttendanceTone,
} from "../lib/absence.ts";
import { invalidateQueries } from "../lib/query-cache.ts";
import { expandSubjectCode } from "../lib/subject-codes.ts";
import { ErrorBanner } from "../components/DashCard.tsx";
import ConfirmDialog, { btnPrimaryClass, btnSecondaryClass } from "../components/ConfirmDialog.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { cn } from "../lib/utils.ts";

const DAYS = [0, 1, 2, 3, 4] as const;

const toneClass: Record<AttendanceTone, string> = {
  present: "bg-green-50 text-green-700",
  absent: "bg-red-50 text-red-700",
  explained: "bg-amber-50 text-amber-800",
  reported: "bg-violet-50 text-violet-700",
  pending: "bg-slate-100 text-slate-500",
  muted: "bg-slate-100 text-slate-400 line-through",
};

type Pending =
  | { kind: "day"; dayId: number; date: Date; remove: boolean }
  | { kind: "lesson"; lesson: AbsenceLesson; date: Date; remove: boolean };

export default function AbsencePage() {
  const ctx = useSchoolsoftContext();
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const week = isoWeek(monday);
  const year = isoWeekYear(monday);
  const today = useNow();
  const thisMonday = mondayOf(today);
  const isThisWeek = monday.getTime() === thisMonday.getTime();
  /* The endpoint only knows week numbers, so stay inside one school year. */
  const bounds = schoolYearWeeks(today);
  const atFirst = monday.getTime() <= bounds.first.getTime();
  const atLast = monday.getTime() >= bounds.last.getTime();

  const perms = useQuery(
    ctx && absenceKeys.permissions(ctx.keyPrefix),
    async () =>
      fetchEvaAbsencePermissions(ctx!.school, await ctx!.token(), ctx!.orgId, ctx!.studentId),
    { staleMs: 10 * 60_000 },
  );
  const weekData = useQuery(ctx && absenceKeys.week(ctx.keyPrefix, year, week), async () =>
    fetchEvaAbsenceWeek(
      ctx!.school,
      await ctx!.token(),
      ctx!.orgId,
      ctx!.studentId,
      ctx!.parentUserId,
      week,
    ),
  );

  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function runPending() {
    if (!ctx || !pending) return;
    setBusy(true);
    setActionError(null);
    try {
      const token = await ctx.token();
      if (pending.kind === "day") {
        const d = pending.date;
        await setEvaFullDayAbsence(
          ctx.school,
          token,
          ctx.orgId,
          ctx.studentId,
          ctx.parentUserId,
          week,
          pending.dayId,
          schoolMidnightMs(d.getFullYear(), d.getMonth(), d.getDate()),
          pending.remove,
        );
      } else {
        await setEvaLessonAbsence(
          ctx.school,
          token,
          ctx.orgId,
          ctx.studentId,
          ctx.parentUserId,
          week,
          pending.lesson.lessonId,
          pending.remove,
        );
      }
      setPending(null);
      invalidateQueries(absenceKeys.weekPrefix(ctx.keyPrefix, year, week));
      void weekData.refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const p = perms.data;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Absence</h2>
          <div className="text-[0.85rem] text-slate-500">
            Week {week} · {monday.toLocaleDateString(undefined, { day: "numeric", month: "short" })}{" "}
            – {addDays(monday, 4).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isThisWeek && (
            <button
              type="button"
              onClick={() => setMonday(thisMonday)}
              className="mr-1 text-xs font-medium text-slate-500 transition-colors hover:text-blue-600"
            >
              This week
            </button>
          )}
          <button
            type="button"
            onClick={() => setMonday((m) => addDays(m, -7))}
            disabled={atFirst}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-[3.5rem] text-center text-sm font-semibold text-slate-600 tabular-nums">
            w{week}
          </span>
          <button
            type="button"
            onClick={() => setMonday((m) => addDays(m, 7))}
            disabled={atLast}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {p && (!p.enabled || p.isPreSchool) && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {p.isPreSchool
            ? "Preschool absence is reported in the official SchoolSoft app. Attendance is shown read-only."
            : "Your school doesn't let guardians report absence online. Attendance is shown read-only."}
        </div>
      )}
      {weekData.error && <ErrorBanner>{weekData.error.message}</ErrorBanner>}

      <div className="grid grid-cols-1 gap-[0.85rem] md:grid-cols-3 lg:grid-cols-5">
        {DAYS.map((dayId) =>
          ctx ? (
            <DayColumn
              key={`${year}-${week}-${dayId}`}
              ctx={ctx}
              year={year}
              week={week}
              dayId={dayId}
              date={addDays(monday, dayId)}
              perms={p}
              onAsk={(x) => {
                setActionError(null);
                setPending(x);
              }}
            />
          ) : (
            <Skeleton key={dayId} className="h-64 rounded-[18px]" />
          ),
        )}
      </div>

      {ctx && p?.enabled && !p.isPreSchool && p.allowComment && (
        <WeekComment
          key={`${year}-${week}`}
          ctx={ctx}
          year={year}
          week={week}
          initial={weekData.data?.parentComment ?? ""}
          loading={weekData.loading}
        />
      )}

      <ConfirmDialog
        open={pending !== null}
        title={confirmTitle(pending)}
        confirmLabel={pending?.remove ? "Withdraw report" : "Report absence"}
        danger={pending?.remove}
        busy={busy}
        error={actionError}
        onConfirm={() => void runPending()}
        onClose={() => {
          setPending(null);
          setActionError(null);
        }}
      >
        {pending && confirmBody(pending)}
        {pending && !pending.remove && p && !p.allowChange && (
          <p className="mt-2 font-medium text-slate-700">
            Your school doesn't allow withdrawing a report afterwards.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

function confirmTitle(p: Pending | null): string {
  if (!p) return "";
  if (p.kind === "day") return p.remove ? "Withdraw full-day absence?" : "Report full-day absence?";
  return p.remove ? "Withdraw lesson absence?" : "Report lesson absence?";
}

function confirmBody(p: Pending) {
  const day = p.date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  if (p.kind === "day") {
    return (
      <>
        <strong>{day}</strong>, all lessons. The school is notified straight away.
      </>
    );
  }
  return (
    <>
      <strong>{expandSubjectCode(p.lesson.subject)}</strong>, {day} {p.lesson.startTime}–
      {p.lesson.endTime}. The school is notified straight away.
    </>
  );
}

function DayColumn({
  ctx,
  year,
  week,
  dayId,
  date,
  perms,
  onAsk,
}: {
  ctx: SchoolsoftContext;
  year: number;
  week: number;
  dayId: number;
  date: Date;
  perms: AbsencePermissions | undefined;
  onAsk: (p: Pending) => void;
}) {
  const day = useQuery(absenceKeys.day(ctx.keyPrefix, year, week, dayId), async () =>
    fetchEvaAbsenceDay(
      ctx.school,
      await ctx.token(),
      ctx.orgId,
      ctx.studentId,
      ctx.parentUserId,
      week,
      dayId,
    ),
  );
  const now = useNow().getTime();
  const isToday = date.toDateString() === new Date(now).toDateString();
  const d: AbsenceDay | null | undefined = day.data;
  const lessons = d?.lessons ?? [];
  const fullDay = d?.hasAbsenceReportFullDay ?? false;
  /* Preschool children report through a different flow (preschoolschedule)
   * that isn't implemented here, so their attendance is read-only. */
  const canWrite = perms?.enabled === true && perms.isPreSchool === false;
  /* Withdrawing a report is a "change", which schools can switch off. */
  const canChange = canWrite && perms.allowChange;
  const absent = lessons.filter((l) => lessonAttendance(l).tone === "absent").length;

  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-[18px] border border-l-4 border-slate-200 bg-white shadow",
        isToday ? "border-l-blue-600" : "border-l-slate-300",
      )}
    >
      <header className="flex items-baseline justify-between gap-2 px-4 pt-3.5 pb-1">
        <h3 className="text-[0.95rem] font-bold capitalize">
          {date.toLocaleDateString(undefined, { weekday: "long" })}
        </h3>
        <span className="text-xs text-slate-500">
          {date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-1.5 px-3 pt-1 pb-3">
        {fullDay && (
          <div className="rounded-md bg-violet-50 px-2.5 py-1.5 text-[0.78rem] font-semibold text-violet-700">
            Full day reported absent
          </div>
        )}
        {!fullDay && absent > 0 && (
          <div className="rounded-md bg-red-50 px-2.5 py-1.5 text-[0.78rem] font-semibold text-red-700">
            Absent from {absent} {absent === 1 ? "lesson" : "lessons"}
          </div>
        )}
        {day.error && <ErrorBanner>{day.error.message}</ErrorBanner>}
        {day.loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)
        ) : lessons.length === 0 ? (
          <div className="py-3 text-center text-sm text-slate-400">No lessons</div>
        ) : (
          lessons.map((l) => (
            <LessonRow
              key={l.lessonId}
              ctx={ctx}
              year={year}
              week={week}
              lesson={l}
              ended={lessonEnded(date, l, now)}
              canReport={canWrite && canReportLesson(date, l, fullDay, now)}
              canWithdraw={canChange && canWithdrawLesson(date, l, now)}
              canComment={canWrite && perms?.allowComment === true}
              onReport={() => onAsk({ kind: "lesson", lesson: l, date, remove: false })}
              onWithdraw={() => onAsk({ kind: "lesson", lesson: l, date, remove: true })}
            />
          ))
        )}
        {canWrite && d && (
          <div className="mt-auto pt-2">
            {fullDay
              ? canChange &&
                canReportFullDay(date, lessons, now) && (
                  <button
                    type="button"
                    className={cn(btnSecondaryClass, "w-full")}
                    onClick={() => onAsk({ kind: "day", dayId, date, remove: true })}
                  >
                    Withdraw full day
                  </button>
                )
              : canReportFullDay(date, lessons, now) && (
                  <button
                    type="button"
                    className={cn(btnPrimaryClass, "w-full")}
                    onClick={() => onAsk({ kind: "day", dayId, date, remove: false })}
                  >
                    Report full day
                  </button>
                )}
          </div>
        )}
      </div>
    </section>
  );
}

function LessonRow({
  ctx,
  year,
  week,
  lesson,
  ended,
  canReport,
  canWithdraw,
  canComment,
  onReport,
  onWithdraw,
}: {
  ctx: SchoolsoftContext;
  year: number;
  week: number;
  lesson: AbsenceLesson;
  ended: boolean;
  canReport: boolean;
  canWithdraw: boolean;
  canComment: boolean;
  onReport: () => void;
  onWithdraw: () => void;
}) {
  const status = lessonAttendance(lesson, ended);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(lesson.comment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveEvaAbsenceLessonComment(
        ctx.school,
        await ctx.token(),
        ctx.orgId,
        ctx.studentId,
        ctx.parentUserId,
        week,
        lesson.lessonId,
        draft.trim(),
      );
      setEditing(false);
      invalidateQueries(absenceKeys.weekPrefix(ctx.keyPrefix, year, week));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[0.88rem] font-semibold">
            {expandSubjectCode(lesson.subject)}
          </div>
          <div className="text-[0.75rem] text-slate-500 tabular-nums">
            {lesson.startTime}–{lesson.endTime}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {/* Nothing to say about a lesson that hasn't happened yet. */}
          {(ended || status.tone !== "pending") && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold",
                toneClass[status.tone],
              )}
            >
              {status.label}
            </span>
          )}
          {canReport && (
            <button
              type="button"
              onClick={onReport}
              className="text-[0.75rem] font-semibold whitespace-nowrap text-blue-600 hover:text-blue-700"
            >
              Report absent
            </button>
          )}
          {canWithdraw && (
            <button
              type="button"
              onClick={onWithdraw}
              className="text-[0.75rem] font-semibold text-red-600 hover:text-red-700"
            >
              Withdraw
            </button>
          )}
        </div>
      </div>
      {lesson.comment && !editing && (
        <p className="mt-1 text-[0.78rem] text-slate-600 italic">“{lesson.comment}”</p>
      )}
      {editing && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-[0.8rem]"
            aria-label="Note to the teacher"
          />
          {error && <span className="text-[0.75rem] text-red-700">{error}</span>}
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              className="text-[0.75rem] text-slate-500 hover:text-slate-700"
              onClick={() => {
                setEditing(false);
                setDraft(lesson.comment);
              }}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="text-[0.75rem] font-semibold text-blue-600 hover:text-blue-700"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>
      )}
      {canComment && lesson.hasAbsenceReportForLesson && !editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 inline-flex items-center gap-1 text-[0.72rem] text-slate-500 hover:text-blue-600"
        >
          <MessageSquare className="h-3 w-3" aria-hidden="true" />
          {lesson.comment ? "Edit note" : "Add note"}
        </button>
      )}
    </div>
  );
}

function WeekComment({
  ctx,
  year,
  week,
  initial,
  loading,
}: {
  ctx: SchoolsoftContext;
  year: number;
  week: number;
  initial: string;
  loading: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const value = draft ?? initial;

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      await saveEvaAbsenceWeekComment(
        ctx.school,
        await ctx.token(),
        ctx.orgId,
        ctx.studentId,
        ctx.parentUserId,
        week,
        value.trim(),
      );
      setStatus("Saved.");
      setDraft(null);
      invalidateQueries(absenceKeys.weekPrefix(ctx.keyPrefix, year, week));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not save the comment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-5 rounded-[18px] border border-l-4 border-slate-200 border-l-sky-500 bg-gradient-to-b from-sky-50 to-white to-[60px] px-5 pt-4 pb-5 shadow">
      <h3 className="text-base font-bold tracking-[-0.01em]">Comment for week {week}</h3>
      <p className="mt-0.5 mb-2 text-[0.82rem] text-slate-500">
        Visible to the school, for example the reason for an absence.
      </p>
      <textarea
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        disabled={loading}
        maxLength={1000}
        rows={3}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        aria-label={`Comment for week ${week}`}
      />
      <div className="mt-2 flex items-center justify-end gap-3">
        {status && <span className="text-[0.8rem] text-slate-600">{status}</span>}
        <button
          type="button"
          className={btnPrimaryClass}
          disabled={saving || draft === null || draft === initial}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save comment"}
        </button>
      </div>
    </section>
  );
}
