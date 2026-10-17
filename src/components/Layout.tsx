import { NavLink, Outlet } from 'react-router-dom';
import { Circle, Drama, Languages, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useLanguage, type LanguageCode } from '../lib/language';
import { useClassroomPresence } from '../lib/presence';
import { useTutorStatus } from '../lib/tutorStatus';
import WaitingRoom from '../pages/WaitingRoom';
import Library from '../pages/Library';
import { usePlatformFlags } from '../lib/managers';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import type { TeachingMode } from '../lib/types';

const CORE_NAV_ITEMS = [
  { to: '/', label: 'Classroom', end: true },
  { to: '/sessions', label: 'Sessions', end: false },
  { to: '/study', label: 'Study Hub', end: false },
];
const PUBLIC_NAV_ITEMS = [
  { to: '/tv', label: 'VukaTV', end: false },
  { to: '/varsity', label: 'Varsity', end: false },
  { to: '/points', label: 'Points', end: false },
];

const OWNER_EMAIL = 'youngagripreneurs.ng@gmail.com';

/** Language selector (contract §15): Lucide Languages icon + themed <select>. */
function LanguageSelector() {
  const { lang, setLang, languages } = useLanguage();
  return (
    <label className="flex items-center gap-1.5" title="Interface and AI language">
      <Languages className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden="true" />
      <span className="sr-only">Language</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as LanguageCode)}
        className="w-auto rounded-md border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-neutral-200"
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
  const { profile, role, signOut, isCore, refreshProfile } = useAuth();
  const { otherOnline, otherName } = useClassroomPresence();
  const { approved: approvedTutor, modes, activeMode, loading: tutorLoading } = useTutorStatus();
  const flags = usePlatformFlags();

  const switchMode = async (mode: TeachingMode) => {
    if (!supabase || !profile) return;
    await supabase.from('profiles').update({ active_mode: mode }).eq('id', profile.id);
    await refreshProfile();
  };
  const displayName =
    profile?.full_name?.trim() ||
    (role === 'teacher' ? 'Teacher' : role === 'student' ? 'Learner' : 'Member');
  const navItems = isCore ? [...CORE_NAV_ITEMS, ...PUBLIC_NAV_ITEMS] : PUBLIC_NAV_ITEMS;
  const isAdmin = profile?.email === OWNER_EMAIL;
  // Phase 8 waiting room gate: core accounts and the owner bypass.
  const needsVerification = !!(
    profile &&
    !isCore &&
    !isAdmin &&
    !profile.code_verified &&
    !profile.verification_note
  );

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-md px-2.5 py-1.5 text-sm font-medium transition sm:px-3',
      isActive ? 'bg-white/10 text-white' : 'text-neutral-300 hover:bg-white/5 hover:text-white',
    );

  return (
    <div className="relative flex min-h-screen flex-col bg-ivory text-ink-soft">
      {/* Official black government-style bar */}
      <div className="bg-[#007749] py-1 text-center text-[11px] font-medium tracking-wide text-white">
        VukaTV — South African low-data learning platform
      </div>

      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-900">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <NavLink
            to="/"
            className="flex items-center gap-2 whitespace-nowrap text-base font-bold text-white sm:text-lg"
          >
            <Drama className="h-5 w-5 shrink-0" aria-hidden="true" />
            VukaTV
          </NavLink>

          <nav aria-label="Main navigation" className="mx-auto flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ))}
            {role === 'teacher' && !tutorLoading && approvedTutor && (
              <NavLink to="/studio" className={navClass}>
                Studio
              </NavLink>
            )}
            {!isAdmin && !tutorLoading && !approvedTutor && (
              <NavLink to="/apply" className={navClass}>
                Become a tutor
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/approvals" className={navClass}>
                Approvals
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/office" className={navClass}>
                Office
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/team" className={navClass}>
                Team
              </NavLink>
            )}
            <NavLink to="/meetings" className={navClass}>
              Meetings
            </NavLink>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Presence pill: core members only — private space. */}
            {isCore && (
              <div
                className="hidden items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800 px-2.5 py-1 md:flex"
                title={otherOnline && otherName ? `${otherName} is online` : 'No one else is online'}
              >
                <Circle
                  className={cn(
                    'h-2 w-2',
                    otherOnline
                      ? 'fill-emerald-500 text-emerald-500'
                      : 'fill-neutral-500 text-neutral-500',
                  )}
                  aria-hidden="true"
                />
                <span className="font-label text-[10px] normal-case text-neutral-300">
                  {otherOnline && otherName ? `${otherName} is online` : 'No one else is online'}
                </span>
              </div>
            )}
            <LanguageSelector />
            <div className="hidden items-center gap-2 sm:flex">
              <span className="max-w-[10rem] truncate text-sm text-neutral-200">{displayName}</span>
              {role === 'teacher' ? (
                <span className="badge-teacher">Teacher</span>
              ) : role === 'student' ? (
                <span className="badge-learner">Learner</span>
              ) : null}
              {approvedTutor && modes.length > 1 && (
                <select
                  value={activeMode}
                  onChange={(e) => void switchMode(e.target.value as TeachingMode)}
                  className="rounded-md border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-neutral-200"
                  aria-label="Teaching mode"
                  title="Switch between High School and University teaching"
                >
                  <option value="highschool">High School</option>
                  <option value="varsity">University</option>
                </select>
              )}
            </div>
            <NavLink
              to="/settings"
              className="rounded-md border border-neutral-600 p-1.5 text-neutral-200 transition hover:bg-neutral-800"
              aria-label="Account settings"
              title="Account settings"
            >
              <SettingsIcon className="h-4 w-4" aria-hidden="true" />
            </NavLink>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border border-neutral-600 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-neutral-800"
              aria-label="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {flags.lockdown && !isAdmin ? (
          <div className="card-playbill mx-auto max-w-xl p-8 text-center">
            <h1 className="text-xl font-bold text-ink">VukaTV is temporarily in lockdown</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Our security team is protecting the platform. Everything is safe — please check back
              shortly. Your data, points and lessons are untouched.
            </p>
          </div>
        ) : profile?.safe_room ? (
          <div className="card-playbill mx-auto max-w-xl p-8 text-center">
            <h1 className="text-xl font-bold text-ink">Your account is in the safe room</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Your account is temporarily under review by the VukaTV team. Nothing is lost — if you
              believe this is a mistake, reply to any VukaTV email and we will look into it.
            </p>
          </div>
        ) : profile?.library_hold_until && new Date(profile.library_hold_until).getTime() > Date.now() && !isAdmin ? (
          <Library />
        ) : profile?.deactivated_at ? (
          <div className="card-playbill mx-auto max-w-xl p-8 text-center">
            <h1 className="text-xl font-bold text-ink">Your account is deactivated</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Everything is exactly as you left it. Reactivate to continue learning or teaching.
            </p>
            <button
              type="button"
              className="btn-gold mt-4"
              onClick={async () => {
                if (!supabase || !profile) return;
                await supabase.from('profiles').update({ deactivated_at: null }).eq('id', profile.id);
                await refreshProfile();
              }}
            >
              Reactivate my account
            </button>
          </div>
        ) : needsVerification ? (
          <WaitingRoom />
        ) : (
          <Outlet />
        )}
      </main>

      <footer className="relative z-10 border-t border-sand py-3 text-center font-label text-[10px] text-ink-soft/70">
        VukaTV — low-data learning, on air
      </footer>
    </div>
  );
}
