import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

/** True only when both required env vars are present. Check this before using `supabase`. */
export const supabaseConfigured: boolean = url.length > 0 && anonKey.length > 0;

/**
 * The Supabase client, or `null` when env vars are missing.
 * Always guard with `supabaseConfigured` (or a null check) before use —
 * importing this module never throws.
 */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url, anonKey)
  : null;

/** Names of env vars that are missing (for the SetupScreen). */
export const missingEnvVars: string[] = [
  ...(url ? [] : ['VITE_SUPABASE_URL']),
  ...(anonKey ? [] : ['VITE_SUPABASE_ANON_KEY']),
];

/** Google Calendar id used for the Sessions embed (optional). */
export const gcalId: string | null =
  (import.meta.env.VITE_GCAL_ID as string | undefined)?.trim() || null;
