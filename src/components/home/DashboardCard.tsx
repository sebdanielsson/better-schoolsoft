import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils.ts";

const accentClasses: Record<"primary" | "warm" | "cool" | "green" | "purple", string> = {
  primary: "border-l-blue-600 bg-gradient-to-b from-blue-50 to-white to-[60px]",
  warm: "border-l-amber-500 bg-gradient-to-b from-amber-50 to-white to-[60px]",
  cool: "border-l-sky-500 bg-gradient-to-b from-sky-50 to-white to-[60px]",
  green: "border-l-green-600 bg-gradient-to-b from-green-50 to-white to-[60px]",
  purple: "border-l-violet-500 bg-gradient-to-b from-violet-50 to-white to-[60px]",
};

const cardClass =
  "relative overflow-hidden rounded-[18px] border border-slate-200 border-l-4 shadow flex flex-col transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-lg";
const cardHeaderClass = "flex items-baseline justify-between px-5 pt-4 pb-1";
const cardHeaderTitleClass = "text-base font-bold tracking-[-0.01em]";
const cardLinkClass = "text-xs font-medium text-slate-500 transition-colors hover:text-blue-600";
const cardBodyClass = "flex-1 px-5 pb-5 pt-2";
export const cardLoadingClass = "py-4 text-sm text-slate-500";

/** A half-width dashboard card with an accent stripe and optional "see more" link. */
export function DashboardCard({
  title,
  accent = "primary",
  linkTo,
  linkLabel,
  children,
}: {
  title: string;
  accent?: keyof typeof accentClasses;
  linkTo?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(cardClass, accentClasses[accent], "md:col-span-6")}>
      <header className={cardHeaderClass}>
        <h3 className={cardHeaderTitleClass}>{title}</h3>
        {linkTo && (
          <Link className={cardLinkClass} to={linkTo}>
            {linkLabel ?? "See more →"}
          </Link>
        )}
      </header>
      <div className={cardBodyClass}>{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-4 text-sm text-slate-500">{children}</div>;
}
