import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

/** Payload each member tracks on the `online-classroom` presence channel (contract §12). */
interface PresenceMeta {
  email?: string;
  role?: string;
  at?: number;
}

export interface ClassroomPresence {
  /** True when the OTHER member (George for Kelebogile, Kelebogile for George) is online. */
  otherOnline: boolean;
  /** Display name of the other online member, or null when flying solo. */
  otherName: string | null;
}

/**
 * Fires `notify-presence` at most once per page session (module-level latch);
 * the server also applies a 3h cooldown (contract §10). Errors are swallowed.
 */
let notifyPresenceFired = false;

function nameForRole(role: string | undefined): string | null {
  if (role === 'teacher') return 'George';
  if (role === 'student') return 'Kelebogile';
  return null;
}

/**
 * Joins the `online-classroom` presence channel on mount, tracks the signed-in
 * member, and reports whether the other member is online (contract §12).
 * Cleans up the channel on unmount.
 */
export function useClassroomPresence(): ClassroomPresence {
  const { profile, role } = useAuth();
  const [otherName, setOtherName] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !profile) return;
    const client = supabase;
    const myEmail = profile.email.trim().toLowerCase();

    const channel = client.channel('online-classroom');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceMeta>();
        let other: string | null = null;
        for (const metas of Object.values(state)) {
          for (const meta of metas) {
            if (meta.email && meta.email.trim().toLowerCase() !== myEmail) {
              other = nameForRole(meta.role) ?? other;
            }
          }
        }
        setOtherName(other);
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        void channel
          .track({ email: myEmail, role: role ?? '', at: Date.now() } satisfies PresenceMeta)
          .then((result) => {
            // First successful track of this page session → notify the other member.
            if (result === 'ok' && !notifyPresenceFired) {
              notifyPresenceFired = true;
              void client.functions.invoke('notify-presence', { body: {} }).then(
                () => undefined,
                () => undefined, // fire-and-forget: swallow errors silently
              );
            }
          })
          .catch(() => {
            /* presence is best-effort */
          });
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [profile, role]);

  return { otherOnline: otherName !== null, otherName };
}
