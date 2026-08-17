import { NavLink, Outlet } from 'react-router-dom';
import { Circle, Drama, Languages } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useLanguage, type LanguageCode } from '../lib/language';
import { useClassroomPresence } from '../lib/presence';
import { cn } from '../lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Classroom', end: true },
  { to: '/sessions', label: 'Sessions', end: false },
  { to: '/study', label: 'Study Hub', end: false },
];

/** Language selector (contract §15): Lucide Languages icon + themed <select>. */
function LanguageSelector() {
  const { lang, setLang, languages } = useLanguage();
  return (
    <label className="flex items-center gap-1.5" title="Interface and AI language">
      <Languages className="h-4 w-4 shrink-0 text-gold-deep" aria-hidden="true" />
      <span className="sr-only">Language</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as LanguageCode)}
        className="input-stage w-auto px-2 py-1 text-xs"
        aria-label="Language"
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}

/** App shell for authenticated pages: top bar + nav + user chip + <Outlet/>. */
export default function Layout() {
  const { profile, role, signOut } = useAuth();
  const { otherOnline, otherName } = useClassroomPresence();
  const displayName =
    profile?.full_name?.trim() ||
    (role === 'teacher' ? 'George' : role === 'student' ? 'Kelebogile' : 'Member');

  return (
    <div className="relative flex min-h-screen flex-col bg-ivory text-ink-soft">
      <div className="spotlight" />

      <header className="sticky top-0 z-20 border-b border-sand bg-ivory/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <NavLink
            to="/"
            className="font-display flex items-center gap-2 whitespace-nowrap text-base font-bold text-gold-deep sm:text-lg"
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
                      ? 'bg-gold/15 text-gold-deep shadow-[inset_0_0_0_1px_rgba(201,153,46,0.4)]'
                      : 'text-ink-soft hover:bg-gold/10 hover:text-ink',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Presence pill (contract §12/§14): is the other member online? */}
            <div
              className="hidden items-center gap-1.5 rounded-full border border-sand bg-paper px-2.5 py-1 md:flex"
              title={otherOnline && otherName ? `${otherName} is online` : 'No one else is online'}
            >
              <Circle
                className={cn(
                  'h-2 w-2',
                  otherOnline
                    ? 'fill-emerald-500 text-emerald-500'
                    : 'fill-ink-soft/30 text-ink-soft/30',
                )}
                aria-hidden="true"
              />
              <span className="font-label text-[10px] normal-case text-ink-soft">
                {otherOnline && otherName ? `${otherName} is online` : 'No one else is online'}
              </span>
            </div>
            <LanguageSelector />
            <div className="hidden items-center gap-2 sm:flex">
              <span className="max-w-[10rem] truncate text-sm text-ink">{displayName}</span>
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

      <footer className="relative z-10 border-t border-sand py-3 text-center font-label text-[10px] text-ink-soft/70">
        Private tutoring space — George · Kelebogile · Agron
      </footer>
    </div>
  );
}
