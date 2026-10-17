import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { LanguageProvider } from './lib/language';
import { supabaseConfigured } from './lib/supabase';
import SetupScreen from './components/SetupScreen';
import Layout from './components/Layout';

// Route-level code splitting (contract §13): every page is its own lazy chunk.
const Login = lazy(() => import('./pages/Login'));
const Classroom = lazy(() => import('./pages/Classroom'));
const Sessions = lazy(() => import('./pages/Sessions'));
const StudyHub = lazy(() => import('./pages/StudyHub'));
const StudyReader = lazy(() => import('./pages/StudyReader'));
const Studio = lazy(() => import('./pages/Studio'));
const TvGuide = lazy(() => import('./pages/TvGuide'));
const TvPlayer = lazy(() => import('./pages/TvPlayer'));
const TakeQuiz = lazy(() => import('./pages/TakeQuiz'));
const Points = lazy(() => import('./pages/Points'));
const Varsity = lazy(() => import('./pages/Varsity'));
const VarsityRoom = lazy(() => import('./pages/VarsityRoom'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Office = lazy(() => import('./pages/Office'));
const Apply = lazy(() => import('./pages/Apply'));
const Settings = lazy(() => import('./pages/Settings'));
const Team = lazy(() => import('./pages/Team'));
const Meetings = lazy(() => import('./pages/Meetings'));
const ScreeningTest = lazy(() => import('./pages/ScreeningTest'));
const About = lazy(() => import('./pages/About'));
const Tutors = lazy(() => import('./pages/Tutors'));

/** Themed full-page fallback: gold spinner on ivory (contract §13). */
function LoadingSpinner() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-ivory"
      role="status"
      aria-label="Loading"
    >
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gold/25 border-t-gold" />
        <p className="font-label mt-4 text-xs text-ink-soft">Loading…</p>
      </div>
    </div>
  );
}

/** Guard: requires a valid session, else redirects to /login. */
function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** Guard (Phase 3): private core spaces only; public users land on VukaTV. */
function RequireCore({ children }: { children: JSX.Element }) {
  const { isCore, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!isCore) return <Navigate to="/tv" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Public landing page — crawlable without an account. */}
        <Route path="/about" element={<About />} />
        <Route path="/tutors" element={<Tutors />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<RequireCore><Classroom /></RequireCore>} />
          <Route path="sessions" element={<RequireCore><Sessions /></RequireCore>} />
          <Route path="study" element={<RequireCore><StudyHub /></RequireCore>} />
          {/* Contract §13: the page-by-page reader is its own lazy route. */}
          <Route path="study/reader" element={<RequireCore><StudyReader /></RequireCore>} />
          {/* Telegraph Engine: recorder (teacher) + player (all members). */}
          <Route path="studio" element={<Studio />} />
          <Route path="tv" element={<TvGuide />} />
          <Route path="tv/:broadcastId" element={<TvPlayer />} />
          {/* Phase 2: cheat-proof quizzes + Vuka Points. */}
          <Route path="quiz/:quizId" element={<TakeQuiz />} />
          <Route path="points" element={<Points />} />
          {/* Phase 4: Varsity Engine — paid sessions + manual EFT. */}
          <Route path="varsity" element={<Varsity />} />
          <Route path="varsity/room/:bookingId" element={<VarsityRoom />} />
          <Route path="approvals" element={<Approvals />} />
          {/* Phase 5: CEO Office (owner-only platform oversight). */}
          <Route path="office" element={<Office />} />
          {/* Phase 6: tutor screening application */}
          <Route path="apply" element={<Apply />} />
          <Route path="screening-test/:testId" element={<ScreeningTest />} />
          <Route path="settings" element={<Settings />} />
          <Route path="team" element={<Team />} />
          <Route path="meetings" element={<Meetings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  // Contract §6: no env vars → branded setup screen for ALL routes (no crash).
  if (!supabaseConfigured) return <SetupScreen />;

  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Contract §15: language choice available to every signed-in screen. */}
        <LanguageProvider>
          <AppRoutes />
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
