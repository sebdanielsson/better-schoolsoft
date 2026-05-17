import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import HomePage from "./HomePage.tsx";
import SchedulePage from "./SchedulePage.tsx";
import CalendarPage from "./CalendarPage.tsx";
import NewsPage from "./NewsPage.tsx";
import MessagesPage from "./MessagesPage.tsx";
import ProfilePage from "./ProfilePage.tsx";
import StaffPage from "./StaffPage.tsx";
import AssessmentsPage from "./AssessmentsPage.tsx";
import AssessmentDetailPage from "./AssessmentDetailPage.tsx";
import AssignmentDetailPage from "./AssignmentDetailPage.tsx";
import PlanningDetailPage from "./PlanningDetailPage.tsx";
import HeroCard from "../components/HeroCard.tsx";
import { HeroDataProvider } from "../hooks/useHeroData.tsx";

export default function DashboardPage() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <HeroDataProvider>
      <div className="flex flex-col min-h-dvh">
        <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-7">
          <HeroCard />
          {!isHome && (
            <Link
              to="/"
              className="inline-flex items-center gap-[0.4rem] mb-4 px-[0.85rem] py-[0.4rem] bg-white border border-slate-200 rounded-full text-slate-500 text-[0.85rem] font-medium no-underline transition-colors hover:bg-blue-50 hover:text-blue-600 hover:border-blue-600"
            >
              <span aria-hidden="true">←</span> Home
            </Link>
          )}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/assessments" element={<AssessmentsPage />} />
            <Route path="/assessments/:id" element={<AssessmentDetailPage />} />
            <Route path="/assignments/:id" element={<AssignmentDetailPage />} />
            <Route path="/plannings/:planningId/:partId" element={<PlanningDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HeroDataProvider>
  );
}
