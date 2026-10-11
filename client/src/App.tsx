/**
 * App shell: auth provider + route table.
 *
 * /                    → public landing page
 * /login               → sign-in (redirects to /dashboard when signed in)
 * /register            → registration (redirects to /dashboard when signed in)
 * /contact             → public contact form
 * /features            → public feature overview (honest capability notes)
 * /how-it-works        → public 4-step guide
 * /about               → public about page
 * /privacy             → public privacy policy
 * /terms               → public terms of use
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
 * /cv-builder          → protected AI CV builder (Phase 3)
 * /skill-gap           → protected skill gap analysis (Phase 3)
 * /english-practice    → protected English practice (Phase 3)
 * /logo-concepts       → public logo concept gallery (Phase 3)
 */
import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import Admin, { NotAuthorized } from "./pages/Admin";
import About from "./pages/About";
import Chat from "./pages/Chat";
import Contact from "./pages/Contact";
import CvBuilder from "./pages/CvBuilder";
import Cvs from "./pages/Cvs";
import Dashboard from "./pages/Dashboard";
import Features from "./pages/Features";
import History from "./pages/History";
import HowItWorks from "./pages/HowItWorks";
import InterviewReport from "./pages/InterviewReport";
import InterviewRunner from "./pages/InterviewRunner";
import InterviewSetup from "./pages/InterviewSetup";
import JobProfiles from "./pages/JobProfiles";
import EnglishPractice from "./pages/EnglishPractice";
import Landing from "./pages/Landing";
import LanguageSettings from "./pages/LanguageSettings";
import Login from "./pages/Login";
import LogoConcepts from "./pages/LogoConcepts";
import Privacy from "./pages/Privacy";
import Progress from "./pages/Progress";
import Register from "./pages/Register";
import SkillGap from "./pages/SkillGap";
import Terms from "./pages/Terms";

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
        <Route path="/features" element={<Features />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/logo-concepts" element={<LogoConcepts />} />
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
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
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
          path="/cv-builder"
          element={
            <ProtectedRoute>
              <CvBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/skill-gap"
          element={
            <ProtectedRoute>
              <SkillGap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/english-practice"
          element={
            <ProtectedRoute>
              <EnglishPractice />
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
