import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Frontend mirror of the management roster (display metadata only). */
export interface ManagerMeta {
  key: string;
  name: string;
  title: string;
  portfolio: string;
  hoursLabel: string;
}

export const MANAGERS: ManagerMeta[] = [
  {
    key: 'hr',
    name: 'Dr. Thandi Mokoena',
    title: 'HR Manager · PhD (Human Resource Management)',
    portfolio: 'Tutor welfare, complaints log, tutors\u2019 meeting preparation, accountability follow-ups.',
    hoursLabel: 'Mon–Sun · weekdays 04:00–21:00 · weekends 06:00–21:00 SAST',
  },
  {
    key: 'quality',
    name: 'Dr. Pieter van der Merwe',
    title: 'Quality Specialist · PhD (Education Quality Assurance)',
    portfolio: 'Independent analysis of every complaint, lesson-quality audits, meeting agenda advice.',
    hoursLabel: 'Mon–Sun · weekdays 04:00–21:00 · weekends 06:00–21:00 SAST',
  },
  {
    key: 'principal',
    name: 'Naledi Dlamini',
    title: 'Principal',
    portfolio: 'Daily morning talk to students, academic tone-setting, tutor accountability with HR.',
    hoursLabel: 'Mon–Sun · weekdays 04:00–21:00 · weekends 06:00–21:00 SAST',
  },
  {
    key: 'security',
    name: 'Dr. Sibusiso Nkosi',
    title: 'Head of Security · PhD (Cybersecurity)',
    portfolio: 'Leads 17 automated IT-specialist checks, Sunday security report, Red Button advisor.',
    hoursLabel: 'Mon–Sat · 04:00–21:00 (Sat from 06:00) SAST · Sundays: report only',
  },
  {
    key: 'finance',
    name: 'Dr. Ayesha Patel',
    title: 'Finance & Payouts Officer · PhD (Financial Forensics)',
    portfolio: 'VP ledger integrity, EFT fraud watch, payout preparation and reconciliation.',
    hoursLabel: 'Mon–Sun · weekdays 04:00–21:00 · weekends 06:00–21:00 SAST',
  },
  {
    key: 'academics',
    name: 'Prof. Johan Erasmus',
    title: 'Head of Academics',
    portfolio: 'CAPS/NSC alignment, university course standards, flagged lesson and screening review.',
    hoursLabel: 'Mon–Sun · weekdays 04:00–21:00 · weekends 06:00–21:00 SAST',
  },
  {
    key: 'learner_success',
    name: 'Dr. Lerato Maseko',
    title: 'Learner Success Manager · PhD (Educational Psychology)',
    portfolio: 'Learner complaints, dropout risk, engagement — the students\u2019 voice in management.',
    hoursLabel: 'Mon–Sun · weekdays 04:00–21:00 · weekends 06:00–21:00 SAST',
  },
];

export interface PlatformFlags {
  lockdown: boolean;
  signups_disabled: boolean;
  payments_disabled: boolean;
}

const DEFAULT_FLAGS: PlatformFlags = {
  lockdown: false,
  signups_disabled: false,
  payments_disabled: false,
};

/** Reads the red-button kill switches. */
export function usePlatformFlags(): PlatformFlags {
  const [flags, setFlags] = useState<PlatformFlags>(DEFAULT_FLAGS);
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('platform_settings').select('key, value');
      if (cancelled || !data) return;
      const next = { ...DEFAULT_FLAGS };
      for (const row of data as { key: string; value: unknown }[]) {
        if (row.key in next) (next as Record<string, boolean>)[row.key] = row.value === true;
      }
      setFlags(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return flags;
}
