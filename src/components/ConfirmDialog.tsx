import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog.tsx";
import { cn } from "../lib/utils.ts";

/* Button styles shared with the profile forms. */
export const btnPrimaryClass =
  "bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer border-0";
export const btnSecondaryClass =
  "bg-white border border-slate-200 text-slate-900 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer";
export const btnDangerClass =
  "bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer border-0";

/** Asks before an action that reaches the school (booking a time, reporting
 *  absence, sending a message). Nothing is sent until the user confirms. */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busy = false,
  danger = false,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="gap-0 rounded-2xl bg-white p-6 text-slate-900 sm:max-w-md"
      >
        <DialogTitle className="font-sans text-lg font-bold tracking-[-0.01em] normal-case">
          {title}
        </DialogTitle>
        {children && (
          <DialogDescription render={<div />} className="mt-2 text-sm text-slate-600">
            {children}
          </DialogDescription>
        )}
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={btnSecondaryClass} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={cn(danger ? btnDangerClass : btnPrimaryClass)}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
