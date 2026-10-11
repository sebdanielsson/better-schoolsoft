import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award,
  Bell,
  CalendarClock,
  CalendarRange,
  Check,
  CheckCircle2,
  ClipboardList,
  Mail,
  Newspaper,
  Star,
  type LucideIcon,
} from "lucide-react";
import { useNotifications } from "../hooks/useNotifications.ts";
import { useHeroData } from "../hooks/useHeroData.tsx";
import { useNow } from "../hooks/useNow.ts";
import {
  KIND_LABEL,
  relativeTime,
  type NotificationItem,
  type NotificationKind,
} from "../lib/notifications.ts";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog.tsx";
import ConfirmDialog, { btnSecondaryClass } from "./ConfirmDialog.tsx";
import { Skeleton } from "./ui/skeleton.tsx";
import { cn } from "../lib/utils.ts";

const KIND_STYLE: Record<NotificationKind, { icon: LucideIcon; tint: string }> = {
  message: { icon: Mail, tint: "bg-red-50 text-red-600" },
  news: { icon: Newspaper, tint: "bg-violet-50 text-violet-600" },
  booking: { icon: CalendarClock, tint: "bg-green-50 text-green-700" },
  assignment: { icon: ClipboardList, tint: "bg-rose-50 text-rose-600" },
  result: { icon: Award, tint: "bg-emerald-50 text-emerald-700" },
  planning: { icon: CalendarRange, tint: "bg-sky-50 text-sky-700" },
  assessment: { icon: Star, tint: "bg-amber-50 text-amber-700" },
};

/** Hero pill that opens the notification center. Matches the Settings pill;
 *  turns solid with a red count when something is unread. */
export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const n = useNotifications();
  const count = n.items.length;
  const active = !n.loading && count > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          n.refresh();
        }}
        aria-label={n.loading ? "Notifications" : `${count} new ${count === 1 ? "item" : "items"}`}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-1 rounded-full border-0 font-[inherit] font-medium backdrop-blur-[4px] transition-colors",
          "shrink-0 grow-0 basis-[calc(50%-0.2rem)] py-[0.15rem] pr-[0.55rem] pl-[0.3rem] text-[11px] sm:basis-auto sm:gap-1.5 sm:py-1 sm:pr-[0.7rem] sm:pl-[0.4rem] sm:text-xs",
          active
            ? "bg-white font-semibold text-[var(--color-primary)] hover:bg-white/90"
            : "bg-white/15 text-white hover:bg-white/30",
        )}
      >
        {n.loading ? (
          <Skeleton className="h-[1.2rem] w-[1.2rem] shrink-0 rounded-full !bg-white/55 sm:h-[1.4rem] sm:w-[1.4rem]" />
        ) : active ? (
          <span className="inline-flex h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full bg-[var(--color-error)] px-[0.4em] font-bold text-white sm:h-[1.4rem] sm:min-w-[1.4rem]">
            {count}
          </span>
        ) : (
          <Bell
            className="h-[1.2rem] w-[1.2rem] p-[0.15rem] sm:h-[1.4rem] sm:w-[1.4rem]"
            aria-hidden="true"
          />
        )}
        <span className="whitespace-nowrap">{active ? "New" : "No news"}</span>
      </button>
      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const n = useNotifications();
  const { child } = useHeroData();
  const navigate = useNavigate();
  const now = useNow().getTime();
  const [confirmAll, setConfirmAll] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function clearOne(item: NotificationItem) {
    setBusyKey(item.key);
    setError(null);
    try {
      await n.markRead(item);
    } catch {
      setError(`Couldn't mark "${item.title}" as read. Try again.`);
    } finally {
      setBusyKey(null);
    }
  }

  async function clearAll() {
    setClearing(true);
    setError(null);
    const failed = await n.markAllRead();
    setClearing(false);
    setConfirmAll(false);
    if (failed > 0)
      setError(`${failed} ${failed === 1 ? "item" : "items"} couldn't be marked as read.`);
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !clearing) onClose();
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 text-slate-900 sm:max-w-[560px]">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 pt-5 pr-14 pb-4">
          <div className="min-w-0">
            <DialogTitle className="font-sans text-lg font-bold tracking-[-0.01em] normal-case">
              What's new{child ? ` for ${child.firstName}` : ""}
            </DialogTitle>
            <p className="mt-0.5 text-[0.82rem] text-slate-500">
              {n.loading
                ? "Checking for new items…"
                : n.items.length === 0
                  ? "Nothing unread."
                  : `${n.items.length} unread ${n.items.length === 1 ? "item" : "items"}`}
            </p>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mx-5 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {n.loading && n.items.length === 0 ? (
            <ul className="flex flex-col gap-1.5" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex gap-3 rounded-lg px-2 py-2">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 rounded-sm" />
                    <Skeleton className="mt-1.5 h-3 w-32 rounded-sm" />
                  </div>
                </li>
              ))}
            </ul>
          ) : n.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-slate-500">
              <CheckCircle2 className="h-9 w-9 text-green-600" aria-hidden="true" />
              <div className="font-semibold text-slate-700">You're all caught up</div>
              <div className="text-sm">
                New messages, news, results and assignments show up here.
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {n.items.map((item) => {
                const { icon: Icon, tint } = KIND_STYLE[item.kind];
                return (
                  <li
                    key={item.key}
                    className="group flex items-stretch gap-1 rounded-lg hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-left"
                      onClick={() => {
                        /* The destination page marks it read, as SchoolSoft does. */
                        onClose();
                        void navigate(item.href);
                      }}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                          tint,
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[0.72rem] font-semibold tracking-wide text-slate-500 uppercase">
                          {KIND_LABEL[item.kind]}
                          <span className="font-normal tracking-normal normal-case">
                            {relativeTime(item.time, now)}
                          </span>
                        </span>
                        <span className="block truncate text-[0.92rem] font-semibold text-slate-900">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="block truncate text-[0.8rem] text-slate-500">
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void clearOne(item)}
                      disabled={busyKey === item.key || clearing}
                      aria-label={`Mark "${item.title}" as read`}
                      title="Mark as read"
                      className="my-auto mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-green-50 hover:text-green-700 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {n.failed.length > 0 && (
            <p className="px-2 pt-3 text-[0.78rem] text-slate-500">
              Some sources couldn't be checked ({n.failed.join(", ")}), so this list may be
              incomplete.
            </p>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
          <span className="text-[0.75rem] text-slate-500">Opening an item marks it as read.</span>
          <button
            type="button"
            className={btnSecondaryClass}
            disabled={n.items.length === 0 || clearing}
            onClick={() => setConfirmAll(true)}
          >
            Mark all as read
          </button>
        </footer>
      </DialogContent>

      <ConfirmDialog
        open={confirmAll}
        title={`Mark all ${n.items.length} as read?`}
        confirmLabel="Mark all as read"
        busy={clearing}
        onConfirm={() => void clearAll()}
        onClose={() => setConfirmAll(false)}
      >
        They'll be marked as read in SchoolSoft too, including in the official app. This can't be
        undone.
      </ConfirmDialog>
    </Dialog>
  );
}
