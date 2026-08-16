import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { supabaseConfigured } from './lib/supabase';
import SetupScreen from './components/SetupScreen';
import Layout from './components/Layout';
import Login from './pages/Login';
import Classroom from './pages/Classroom';
import Sessions from './pages/Sessions';
import StudyHub from './pages/StudyHub';

function LoadingSpinner() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-stage-bg"
      role="status"
      aria-label="Loading"
    >
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gold/25 border-t-gold" />
        <p className="font-label mt-4 text-xs text-cream-dim">Raising the curtain…</p>
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  // Contract §6: no env vars → branded setup screen for ALL routes (no crash).
  if (!supabaseConfigured) return <SetupScreen />;

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
