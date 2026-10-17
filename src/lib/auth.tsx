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

/**
 * The two original core accounts (Phase 3): they alone keep access to the
 * private tutoring spaces (Classroom chat, File Vault, Sessions, Study Hub).
 * Everyone else gets the public platform (VukaTV, quizzes, Points, Studio).
 */
const CORE_EMAILS = new Set([
  'youngagripreneurs.ng@gmail.com',
  'youngagripreneursdev@gmail.com',
]);

export function isCoreEmail(email: string | null | undefined): boolean {
  return !!email && CORE_EMAILS.has(email.trim().toLowerCase());
}

export interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  /** True for the two original core accounts (private spaces access). */
  isCore: boolean;
  loading: boolean;
  /** Signs in with email/password. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Creates a public account (Phase 3) with a chosen role; optional WhatsApp (Phase 8). */
  signUp: (email: string, password: string, fullName: string, role: Role, whatsapp?: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-fetches the profile row (after approval, mode switch, etc.). */
  refreshProfile: () => Promise<void>;
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
      await applySession(data.session);
    },
    [applySession],
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName: string, role: Role, whatsapp?: string) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
            ...(whatsapp?.trim() ? { whatsapp: whatsapp.trim() } : {}),
          },
        },
      });
      if (error) throw error;
    },
    [],
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) setProfile(await fetchProfile(session.user.id));
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      role: profile?.role ?? null,
      isCore: isCoreEmail(profile?.email ?? session?.user?.email),
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
