/**
 * App shell: auth provider + route table.
 *
 * /                    → public landing page
 * /login               → sign-in (redirects to /dashboard when signed in)
 * /register            → registration (redirects to /dashboard when signed in)
 * /contact             → public contact form
 * /dashboard           → protected; unauthenticated visitors go to /login
 * /cvs                 → protected CV upload + parsing
 * /jobs                → protected job-profile manager (Phase C)
 * /interview/setup     → protected interview setup (Phase C)
 * /interview/:id       → protected interview runner (Phase C)
 * /interview/:id/report→ protected interview report (Phase C)
 * /settings/languages   → protected language settings (Phase D)
 * /progress            → protected progress overview (Phase F)
 * /history             → protected session history (Phase F)
 * /admin               → admin-only panel (Phase F)
 */
import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import Admin, { NotAuthorized } from "./pages/Admin";
import Contact from "./pages/Contact";
import Cvs from "./pages/Cvs";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import InterviewReport from "./pages/InterviewReport";
import InterviewRunner from "./pages/InterviewRunner";
import InterviewSetup from "./pages/InterviewSetup";
import JobProfiles from "./pages/JobProfiles";
import Landing from "./pages/Landing";
import LanguageSettings from "./pages/LanguageSettings";
import Login from "./pages/Login";
import Progress from "./pages/Progress";
import Register from "./pages/Register";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#64748B",
        }}
      >
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * Admin-only route. Signed-out visitors go to /login; signed-in non-admins
 * get a "Not authorized" page — never a redirect loop (a redirect to
 * /dashboard would just bounce them back here).
 */
function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#64748B",
        }}
      >
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <NotAuthorized />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/contact" element={<Contact />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cvs"
          element={
            <ProtectedRoute>
              <Cvs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jobs"
          element={
            <ProtectedRoute>
              <JobProfiles />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview/setup"
          element={
            <ProtectedRoute>
              <InterviewSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview/:id"
          element={
            <ProtectedRoute>
              <InterviewRunner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview/:id/report"
          element={
            <ProtectedRoute>
              <InterviewReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/languages"
          element={
            <ProtectedRoute>
              <LanguageSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/progress"
          element={
            <ProtectedRoute>
              <Progress />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
