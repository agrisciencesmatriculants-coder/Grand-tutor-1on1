import { NavLink, Outlet } from 'react-router-dom';
import { Circle, Drama } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useClassroomPresence } from '../lib/presence';
import { cn } from '../lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Classroom', end: true },
  { to: '/sessions', label: 'Sessions', end: false },
  { to: '/study', label: 'Study Hub', end: false },
];

/** App shell for authenticated pages: top bar + nav + user chip + <Outlet/>. */
export default function Layout() {
  const { profile, role, signOut } = useAuth();
  const { otherOnline, otherName } = useClassroomPresence();
  const displayName =
    profile?.full_name?.trim() ||
    (role === 'teacher' ? 'George' : role === 'student' ? 'Kelebogile' : 'Cast Member');

  return (
    <div className="relative flex min-h-screen flex-col bg-stage-bg text-cream">
      <div className="spotlight" />

      <header className="sticky top-0 z-20 border-b border-gold/20 bg-stage-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <NavLink
            to="/"
            className="font-display flex items-center gap-2 whitespace-nowrap text-base font-bold text-gold sm:text-lg"
          >
            <Drama className="h-5 w-5 shrink-0" aria-hidden="true" />
            Young Agripreneurs 1 Tutor
          </NavLink>

          <nav aria-label="Main navigation" className="mx-auto flex items-center gap-1 sm:gap-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-2.5 py-1.5 text-sm font-medium transition sm:px-3',
                    isActive
                      ? 'bg-gold/15 text-gold-light shadow-[inset_0_0_0_1px_rgba(232,179,75,0.35)]'
                      : 'text-cream-dim hover:bg-gold/5 hover:text-cream',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Presence pill (contract §12): is the other member on stage? */}
            <div
              className="hidden items-center gap-1.5 rounded-full border border-gold/20 bg-stage-panel/60 px-2.5 py-1 md:flex"
              title={otherOnline && otherName ? `${otherName} is online` : 'The other seat is empty'}
            >
              <Circle
                className={cn(
                  'h-2 w-2',
                  otherOnline
                    ? 'fill-emerald-400 text-emerald-400'
                    : 'fill-cream-dim/30 text-cream-dim/30',
                )}
                aria-hidden="true"
              />
              <span className="font-label text-[10px] normal-case text-cream-dim">
                {otherOnline && otherName ? `${otherName} online` : 'Solo on stage'}
              </span>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="max-w-[10rem] truncate text-sm text-cream">{displayName}</span>
              {role === 'teacher' ? (
                <span className="badge-teacher">Teacher</span>
              ) : role === 'student' ? (
                <span className="badge-learner">Learner</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="btn-ghost px-3 py-1.5 text-xs"
              aria-label="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="relative z-10 border-t border-gold/10 py-3 text-center font-label text-[10px] text-cream-dim/60">
        Private stage — George · Kelebogile · Agron
      </footer>
    </div>
  );
}
