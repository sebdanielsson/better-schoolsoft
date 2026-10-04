import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils.ts";

/* Same visual language as the home dashboard cards: rounded panel, coloured
 * left rule and a faint tinted header gradient. */

export type DashCardAccent = "primary" | "warm" | "cool" | "green" | "purple" | "rose";

const accentClasses: Record<DashCardAccent, string> = {
  primary: "border-l-blue-600 bg-gradient-to-b from-blue-50 to-white to-[60px]",
  warm: "border-l-amber-500 bg-gradient-to-b from-amber-50 to-white to-[60px]",
  cool: "border-l-sky-500 bg-gradient-to-b from-sky-50 to-white to-[60px]",
  green: "border-l-green-600 bg-gradient-to-b from-green-50 to-white to-[60px]",
  purple: "border-l-violet-500 bg-gradient-to-b from-violet-50 to-white to-[60px]",
  rose: "border-l-rose-500 bg-gradient-to-b from-rose-50 to-white to-[60px]",
};

export default function DashCard({
  title,
  accent = "primary",
  action,
  linkTo,
  linkLabel,
  className,
  children,
}: {
  title: ReactNode;
  accent?: DashCardAccent;
  /** Right-aligned header content, e.g. a counter or toggle. */
  action?: ReactNode;
  linkTo?: string;
  linkLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative flex flex-col overflow-hidden rounded-[18px] border border-l-4 border-slate-200 shadow",
        accentClasses[accent],
        className,
      )}
    >
      <header className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-1">
        <h3 className="text-base font-bold tracking-[-0.01em]">{title}</h3>
        {action}
        {linkTo && (
          <Link
            className="text-xs font-medium text-slate-500 transition-colors hover:text-blue-600"
            to={linkTo}
          >
            {linkLabel ?? "See more →"}
          </Link>
        )}
      </header>
      <div className="flex-1 px-5 pt-2 pb-5">{children}</div>
    </section>
  );
}

export function DashCardEmpty({ children }: { children: ReactNode }) {
  return <div className="py-4 text-sm text-slate-500">{children}</div>;
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {children}
    </div>
  );
}

/** Small blue dot used across the app to flag unread items. */
export function UnreadDot() {
  /* A plain span can't carry an accessible name, so the label is real
   * (visually hidden) text. */
  return (
    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-blue-600">
      <span className="sr-only">Unread</span>
    </span>
  );
}
