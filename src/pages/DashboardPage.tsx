import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import HomePage from "./HomePage.tsx";
import SchedulePage from "./SchedulePage.tsx";
import LunchPage from "./LunchPage.tsx";
import CalendarPage from "./CalendarPage.tsx";
import NewsPage from "./NewsPage.tsx";
import MessagesPage from "./MessagesPage.tsx";
import ProfilePage from "./ProfilePage.tsx";
import HeroCard from "../components/HeroCard.tsx";
import { HeroDataProvider } from "../hooks/useHeroData.tsx";

export default function DashboardPage() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <HeroDataProvider>
      <div className="dashboard">
        <main className="dashboard-content">
          <HeroCard />
          {!isHome && (
            <Link to="/" className="back-to-home">
              <span aria-hidden="true">←</span> Home
            </Link>
          )}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/lunch" element={<LunchPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HeroDataProvider>
  );
}
