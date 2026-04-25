import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.tsx';
import SchedulePage from './SchedulePage.tsx';
import LunchPage from './LunchPage.tsx';
import CalendarPage from './CalendarPage.tsx';

export default function DashboardPage() {
  const { session, logout } = useAuth();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-brand">
          <span className="header-title">Better SchoolSoft</span>
          {session && (
            <span className="header-user">
              {greeting}, {session.name}
            </span>
          )}
        </div>
        <button className="btn-logout" onClick={logout}>
          Sign out
        </button>
      </header>

      <nav className="dashboard-nav">
        <NavLink to="/schedule" className={({ isActive }) => (isActive ? 'active' : '')}>
          Schedule
        </NavLink>
        <NavLink to="/lunch" className={({ isActive }) => (isActive ? 'active' : '')}>
          Lunch
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => (isActive ? 'active' : '')}>
          Calendar
        </NavLink>
      </nav>

      <main className="dashboard-content">
        <Routes>
          <Route path="/" element={<Navigate to="/schedule" replace />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/lunch" element={<LunchPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </main>
    </div>
  );
}
