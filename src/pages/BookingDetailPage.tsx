import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Video } from "lucide-react";
import { useSchoolsoftContext } from "../hooks/useSchoolsoftContext.tsx";
import { useQuery } from "../hooks/useQuery.ts";
import {
  EvaWriteError,
  fetchEvaTimebooking,
  markEvaTimebookingRead,
  updateEvaTimebookingTime,
  type TimebookingAction,
  type TimebookingDetail,
  type TimebookingTime,
} from "../api/schoolsoft.ts";
import {
  bookingKeys,
  formatBookingDay,
  formatSlotTime,
  isSelectable,
  sameSlot,
  statusChipClass,
  statusMeta,
  studentSlot,
} from "../lib/bookings.ts";
import { invalidateQueries } from "../lib/query-cache.ts";
import { safeHttpUrl } from "../lib/safe-url.ts";
import DashCard, { DashCardEmpty, ErrorBanner } from "../components/DashCard.tsx";
import ConfirmDialog, { btnPrimaryClass, btnSecondaryClass } from "../components/ConfirmDialog.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { cn } from "../lib/utils.ts";

interface PendingAction {
  action: TimebookingAction;
  slot: TimebookingTime;
}

const ACTION_COPY: Record<TimebookingAction, { title: string; confirm: string }> = {
  reserve: { title: "Book this time?", confirm: "Book time" },
  confirm: { title: "Confirm the proposed time?", confirm: "Confirm time" },
  cancel: { title: "Cancel your booked time?", confirm: "Cancel booking" },
};

export default function BookingDetailPage() {
  const { id: param } = useParams<{ id: string }>();
  const id = Number(param);
  const valid = Number.isInteger(id) && id > 0;
  const ctx = useSchoolsoftContext();
  const c = valid ? ctx : null;

  const detail = useQuery(c && bookingKeys.detail(c.keyPrefix, id), async () =>
    fetchEvaTimebooking(c!.school, await c!.token(), c!.parentUserId, c!.studentId, c!.orgId, id),
  );

  const [selected, setSelected] = useState<TimebookingTime | undefined>();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /* Opening a booking marks it read, as the official app does. Fire and
   * forget: a failed read marker is not worth surfacing. */
  const unread = detail.data ? !detail.data.isRead : false;
  useEffect(() => {
    if (!c || !unread) return;
    void (async () => {
      try {
        await markEvaTimebookingRead(c.school, await c.token(), c.parentUserId, id);
        invalidateQueries(bookingKeys.list(c.keyPrefix));
      } catch {
        /* ignore */
      }
    })();
  }, [c, id, unread]);

  if (!valid) return <ErrorBanner>That booking link is not valid.</ErrorBanner>;

  async function run() {
    if (!c || !pending) return;
    setBusy(true);
    setActionError(null);
    try {
      await updateEvaTimebookingTime(
        c.school,
        await c.token(),
        c.parentUserId,
        c.studentId,
        c.orgId,
        pending.action,
        pending.slot.timebookingTimeKey,
      );
      setNotice(
        pending.action === "cancel"
          ? "Your booking was cancelled."
          : `Booked ${formatBookingDay(pending.slot.date ?? pending.slot.startTime)}, ${formatSlotTime(pending.slot)}.`,
      );
      setPending(null);
      setSelected(undefined);
      invalidateQueries(c.keyPrefix + "timebooking");
      await detail.refetch();
    } catch (e) {
      setActionError(
        e instanceof EvaWriteError && e.status === 409
          ? "Someone else just booked that time. Pick another one."
          : e instanceof Error
            ? e.message
            : "Something went wrong.",
      );
      if (e instanceof EvaWriteError && e.status === 409) void detail.refetch();
    } finally {
      setBusy(false);
    }
  }

  const d = detail.data;
  const held = d ? studentSlot(d) : undefined;
  const meta = d ? statusMeta(d.status) : undefined;

  return (
    <div>
      <div className="mb-5">
        <Link
          to="/bookings"
          className="text-xs font-medium text-slate-500 transition-colors hover:text-blue-600"
        >
          ← All bookings
        </Link>
        {d ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{d.name}</h2>
            {meta && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.75rem] font-semibold",
                  statusChipClass[meta.tone],
                )}
              >
                {meta.label}
              </span>
            )}
          </div>
        ) : (
          <Skeleton className="mt-2 h-7 w-56 rounded-md" />
        )}
        {d?.teacher && (
          <div className="mt-0.5 text-[0.85rem] text-slate-500">
            {d.teacher.fName} {d.teacher.lName}
          </div>
        )}
      </div>

      {detail.error && <ErrorBanner>{detail.error.message}</ErrorBanner>}
      {notice && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {notice}
        </div>
      )}

      {detail.loading ? (
        <Skeleton className="h-48 rounded-[18px]" />
      ) : !d ? (
        !detail.error && <ErrorBanner>This booking is no longer available.</ErrorBanner>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-12">
          <DashCard title="Times" accent="primary" className="md:col-span-7">
            <Hint detail={d} held={held} />
            <SlotList
              detail={d}
              held={held}
              selected={selected}
              onSelect={(s) => setSelected((cur) => (sameSlot(cur, s) ? undefined : s))}
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {held && d.status === "NEEDS_CONFIRMATION" && (
                <button
                  type="button"
                  className={btnPrimaryClass}
                  onClick={() => setPending({ action: "confirm", slot: held })}
                >
                  Confirm proposed time
                </button>
              )}
              {held && d.status === "BOOKED" && d.bookable !== false && !d.onlyStudent && (
                <button
                  type="button"
                  className={btnSecondaryClass}
                  onClick={() => setPending({ action: "cancel", slot: held })}
                >
                  Cancel booking
                </button>
              )}
              {selected && (
                <button
                  type="button"
                  className={btnPrimaryClass}
                  onClick={() => setPending({ action: "reserve", slot: selected })}
                >
                  Book {formatSlotTime(selected)}
                </button>
              )}
            </div>
          </DashCard>

          <div className="flex flex-col gap-5 md:col-span-5">
            <MeetingCard link={d.meetingLink} />
            <DashCard title="Description" accent="cool">
              {d.description?.trim() ? (
                <p className="text-[0.92rem] leading-[1.55] whitespace-pre-wrap text-slate-800">
                  {d.description}
                </p>
              ) : (
                <DashCardEmpty>No description.</DashCardEmpty>
              )}
            </DashCard>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending ? ACTION_COPY[pending.action].title : ""}
        confirmLabel={pending ? ACTION_COPY[pending.action].confirm : ""}
        danger={pending?.action === "cancel"}
        busy={busy}
        error={actionError}
        onConfirm={() => void run()}
        onClose={() => {
          setPending(null);
          setActionError(null);
        }}
      >
        {pending && (
          <>
            <strong>{formatBookingDay(pending.slot.date ?? pending.slot.startTime)}</strong>,{" "}
            {formatSlotTime(pending.slot)}. The teacher is notified straight away.
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

function Hint({ detail, held }: { detail: TimebookingDetail; held: TimebookingTime | undefined }) {
  let text: string | null = null;
  if (detail.onlyStudent) text = "Only the student can book this one.";
  else if (detail.status === "NEEDS_CONFIRMATION" && held)
    text = "The teacher has proposed a time. Confirm it below.";
  else if (detail.status === "BOOKED" && held)
    text = `You're booked for ${formatBookingDay(held.date ?? held.startTime)}, ${formatSlotTime(held)}.`;
  else if (detail.status === "AVAILABLE")
    text = detail.bookableTo
      ? `Pick a time. Booking closes ${formatBookingDay(detail.bookableTo)}.`
      : "Pick a time.";
  else if (detail.status === "NOT_AVAILABLE") text = "There are no free times left.";
  if (!text) return null;
  return <p className="mb-3 text-[0.88rem] text-slate-600">{text}</p>;
}

function SlotList({
  detail,
  held,
  selected,
  onSelect,
}: {
  detail: TimebookingDetail;
  held: TimebookingTime | undefined;
  selected: TimebookingTime | undefined;
  onSelect: (slot: TimebookingTime) => void;
}) {
  const days = (detail.timebookingDates ?? []).filter((day) => day.timebookingTimes?.length);
  if (days.length === 0) return <DashCardEmpty>No times have been published.</DashCardEmpty>;
  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => (
        <section key={String(day.date)}>
          <h4 className="mb-1.5 text-xs font-semibold tracking-[0.05em] text-slate-500 uppercase">
            {formatBookingDay(day.date)}
          </h4>
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {day.timebookingTimes.map((slot) => {
              const mine = sameSlot(slot, held);
              const isSelected = sameSlot(slot, selected);
              const selectable = isSelectable(detail, slot);
              return (
                <li
                  key={`${slot.timebookingTimeKey.timebookingid}-${slot.timebookingTimeKey.sequence}`}
                >
                  <button
                    type="button"
                    disabled={!selectable}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(slot)}
                    title={slot.comment ?? undefined}
                    className={cn(
                      "w-full rounded-md border px-2 py-2 text-center text-[0.85rem] font-medium tabular-nums transition-colors",
                      mine
                        ? "border-green-300 bg-green-50 text-green-800"
                        : isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : selectable
                            ? "cursor-pointer border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"
                            : "border-slate-100 bg-slate-50 text-slate-400 line-through",
                    )}
                  >
                    {formatSlotTime(slot)}
                    {mine && <span className="block text-[0.7rem] font-semibold">Yours</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MeetingCard({ link }: { link: string | null | undefined }) {
  const href = link ? safeHttpUrl(link.trim()) : undefined;
  if (!href) return null;
  return (
    <DashCard title="Online meeting" accent="green">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
      >
        <Video className="h-4 w-4" aria-hidden="true" />
        Join meeting
      </a>
    </DashCard>
  );
}
