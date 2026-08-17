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

/** Guard: requires a valid (allow-listed) session, else redirects to /login. */
function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Classroom />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="study" element={<StudyHub />} />
          {/* Contract §13: the page-by-page reader is its own lazy route. */}
          <Route path="study/reader" element={<StudyReader />} />
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
