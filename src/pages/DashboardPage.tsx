import { Fragment, lazy, Suspense, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./HomePage.tsx";
import HeroCard from "../components/HeroCard.tsx";
import SectionNav from "../components/SectionNav.tsx";
import { HeroDataProvider, useHeroData } from "../hooks/useHeroData.tsx";

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
const SubjectsPage = lazy(() => import("./SubjectsPage.tsx"));
const SubjectRoomPage = lazy(() => import("./SubjectRoomPage.tsx"));
const BookingsPage = lazy(() => import("./BookingsPage.tsx"));
const BookingDetailPage = lazy(() => import("./BookingDetailPage.tsx"));
const AbsencePage = lazy(() => import("./AbsencePage.tsx"));
const SchoolPage = lazy(() => import("./SchoolPage.tsx"));

export default function DashboardPage() {
  return (
    <HeroDataProvider>
      <div className="flex min-h-dvh flex-col">
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-7">
          <HeroCard />
          <SectionNav />
          <ChildScope>
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
                <Route path="/subjects" element={<SubjectsPage />} />
                <Route path="/subjects/:activityId" element={<SubjectRoomPage />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/bookings/:id" element={<BookingDetailPage />} />
                <Route path="/absence" element={<AbsencePage />} />
                <Route path="/school" element={<SchoolPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ChildScope>
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

/** Remount every page when the guardian switches child, so in-progress UI
 *  state (an open booking dialog, an absence note, a message draft) can't be
 *  carried over and then submitted against a sibling. */
function ChildScope({ children }: { children: ReactNode }) {
  const { child } = useHeroData();
  return <Fragment key={child?.studentId ?? "none"}>{children}</Fragment>;
}
