import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { fetchAssignmentsThisWeek } from "../api/schoolsoft.ts";
import WeekCard from "./WeekCard.tsx";
import { cn } from "../lib/utils.ts";

const submissionIconClass = "h-4 w-4 shrink-0";

export function SubmissionIcon({ status }: { status: string }) {
  if (status === "SUBMITTED" || status === "EXPIRED_SUBMITTED") {
    return (
      <CheckCircle2 className={cn(submissionIconClass, "text-green-600")} aria-label="Submitted" />
    );
  }
  if (status === "EXPIRED_NOT_SUBMITTED") {
    return (
      <AlertCircle
        className={cn(submissionIconClass, "text-red-600")}
        aria-label="Past due, not submitted"
      />
    );
  }
  return <FileText className={cn(submissionIconClass, "text-slate-400")} aria-label="Assignment" />;
}

export default function AssignmentsCard() {
  return (
    <WeekCard
      title="Assignments"
      accentClass="border-l-rose-500 from-rose-50"
      noun="assignments"
      emptyCurrentWeek="No assignments this week."
      fetchWeek={fetchAssignmentsThisWeek}
      rowHref={(row) => `/assignments/${row.id}`}
      rowIcon={(row) => <SubmissionIcon status={row.submissionStatus} />}
    />
  );
}
