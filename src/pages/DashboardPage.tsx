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
      <div className="flex min-h-dvh flex-col">
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-7">
          <HeroCard />
          {!isHome && (
            <Link
              to="/"
              className="mb-4 inline-flex items-center gap-[0.4rem] rounded-full border border-slate-200 bg-white px-[0.85rem] py-[0.4rem] text-[0.85rem] font-medium text-slate-500 no-underline transition-colors hover:border-blue-600 hover:bg-blue-50 hover:text-blue-600"
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
      className="h-40 animate-pulse rounded-[18px] bg-slate-100"
      role="status"
      aria-label="Loading page"
    />
  );
}
