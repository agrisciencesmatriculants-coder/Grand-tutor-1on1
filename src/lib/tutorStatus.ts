import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type { TutorApplication, TeachingMode } from './types';

export interface TutorStatus {
  loading: boolean;
  /** The user's tutor application, if any. */
  application: TutorApplication | null;
  /** True when an approved application exists (or the user is the owner). */
  approved: boolean;
  modes: TeachingMode[];
  activeMode: TeachingMode;
  reload: () => Promise<void>;
}

const OWNER_EMAIL = 'youngagripreneurs.ng@gmail.com';

/**
 * Shared tutor-screening status. Gates Studio / Varsity creation and powers
 * the mode switcher in the header.
 */
export function useTutorStatus(): TutorStatus {
  const { profile } = useAuth();
  const [application, setApplication] = useState<TutorApplication | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!supabase || !profile) {
      setApplication(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('tutor_applications')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();
    setApplication((data as TutorApplication | null) ?? null);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const isOwner = profile?.email === OWNER_EMAIL;
  const approved = isOwner || application?.status === 'approved';
  const modes = (profile?.tutor_modes ?? []) as TeachingMode[];

  return {
    loading,
    application,
    approved,
    modes: isOwner ? ['highschool', 'varsity'] : modes,
    activeMode: (profile?.active_mode as TeachingMode) ?? 'highschool',
    reload,
  };
}
