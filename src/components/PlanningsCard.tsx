import { CalendarRange } from "lucide-react";
import { fetchPlanningsThisWeek } from "../api/schoolsoft.ts";
import WeekCard from "./WeekCard.tsx";

export default function PlanningsCard() {
  return (
    <WeekCard
      title="Plannings"
      accentClass="border-l-indigo-500 from-indigo-50"
      noun="plannings"
      emptyCurrentWeek="No plannings active this week."
      fetchWeek={fetchPlanningsThisWeek}
      rowHref={(row) => `/plannings/${row.planningId}/${row.id}`}
      rowIcon={() => (
        <CalendarRange className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
      )}
    />
  );
}
