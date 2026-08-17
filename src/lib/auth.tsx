import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';
import type { Profile, Role } from './types';

/** Display name of the AI tutor persona. */
export const AI_NAME = 'Agron';

/** Only these two accounts may enter the app (HARD GATE). */
const ALLOWED_EMAILS = new Set([
  'youngagripreneurs.ng@gmail.com',
  'youngagripreneursdev@gmail.com',
]);

export interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  /** Signs in with email/password. Throws Error('Access denied') for non-allow-listed emails. */
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('Failed to fetch profile:', error.message);
    return null;
  }
  return data as Profile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback(async (next: Session | null) => {
    // HARD GATE: allow-list check on every session.
    const email = next?.user?.email?.toLowerCase();
    if (next && (!email || !ALLOWED_EMAILS.has(email))) {
      if (supabase) await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      return;
    }
    setSession(next);
    setProfile(next ? await fetchProfile(next.user.id) : null);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled) return;
        await applySession(data.session);
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      // Fire-and-forget: keep state updates async to avoid deadlocks.
      void applySession(next);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const normalized = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
      });
      if (error) throw error;

      // HARD GATE: immediately reject non-allow-listed accounts.
      const signedInEmail = data.user?.email?.toLowerCase();
      if (!signedInEmail || !ALLOWED_EMAILS.has(signedInEmail)) {
        await supabase.auth.signOut();
        throw new Error('Access denied. This application is invitation only.');
      }
      await applySession(data.session);
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      role: profile?.role ?? null,
      loading,
      signIn,
      signOut,
    }),
    [session, profile, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
