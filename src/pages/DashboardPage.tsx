import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import HomePage from "./HomePage.tsx";
import HeroCard from "../components/HeroCard.tsx";
import { HeroDataProvider } from "../hooks/useHeroData.tsx";

/* HomePage stays eager — it is the landing route, so lazy-loading it would only
 * add a round trip. The rest are reached by navigation and cost nothing until
 * then; ProfilePage and StaffPage alone are ~1k lines that every visitor was
 * previously downloading up front. */
const SchedulePage = lazy(() => import("./SchedulePage.tsx"));
const CalendarPage = lazy(() => import("./CalendarPage.tsx"));
const NewsPage = lazy(() => import("./NewsPage.tsx"));
const MessagesPage = lazy(() => import("./MessagesPage.tsx"));
const ProfilePage = lazy(() => import("./ProfilePage.tsx"));
const StaffPage = lazy(() => import("./StaffPage.tsx"));
const AssessmentsPage = lazy(() => import("./AssessmentsPage.tsx"));
const AssessmentDetailPage = lazy(() => import("./AssessmentDetailPage.tsx"));
const AssignmentDetailPage = lazy(() => import("./AssignmentDetailPage.tsx"));
const PlanningDetailPage = lazy(() => import("./PlanningDetailPage.tsx"));

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
          <Suspense fallback={<RouteFallback />}>
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
          </Suspense>
        </main>
      </div>
    </HeroDataProvider>
  );
}

/** Shown while a lazily-loaded route chunk is in flight. Deliberately quiet —
 *  on a warm cache the chunk usually resolves within a frame, and a spinner
 *  that flashes for 16ms reads as jank. */
function RouteFallback() {
  return (
    <div
      className="h-40 rounded-[18px] bg-slate-100 animate-pulse"
      role="status"
      aria-label="Loading page"
    />
  );
}
