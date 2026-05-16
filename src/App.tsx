import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import OAuthCallbackPage from "./pages/OAuthCallbackPage.tsx";

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route
        path="/*"
        element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
