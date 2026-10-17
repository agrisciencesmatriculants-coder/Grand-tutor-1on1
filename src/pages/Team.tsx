import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Briefcase,
  FileBarChart,
  Flag,
  Loader2,
  Lock,
  MessageSquare,
  Send,
  ShieldAlert,
  Unlock,
  Users,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { MANAGERS, usePlatformFlags, type PlatformFlags } from '../lib/managers';
import { cn } from '../lib/utils';
import type { Complaint, LibraryChat, ManagerChatMessage, ManagerReport, SecurityEvent } from '../lib/types';

const OWNER_EMAIL = 'youngagripreneurs.ng@gmail.com';

type Tab = 'team' | 'complaints' | 'reports' | 'security';

/** The CEO's management floor: AI managers, complaints workflow, reports, red button. */
export default function Team() {
  const { profile } = useAuth();
  const isAdmin = profile?.email === OWNER_EMAIL;
  const [tab, setTab] = useState<Tab>('team');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="card-playbill mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-bold text-ink">Management team</h1>
        <p className="mt-2 text-sm text-ink-soft">This page is for the platform owner only.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'team', label: 'Managers', icon: <Users className="h-4 w-4" aria-hidden="true" /> },
    { id: 'complaints', label: 'Complaints', icon: <MessageSquare className="h-4 w-4" aria-hidden="true" /> },
    { id: 'reports', label: 'Reports', icon: <FileBarChart className="h-4 w-4" aria-hidden="true" /> },
    { id: 'security', label: 'Security', icon: <ShieldAlert className="h-4 w-4" aria-hidden="true" /> },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
          <Briefcase className="h-6 w-6 text-gold-deep" aria-hidden="true" />
          Management team
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Your AI management floor. Chat with any manager during their working hours, work the
          complaints pipeline with HR and Quality, read the weekly reports, and hold the Red Button.
        </p>
      </header>

      {error && <div className="border border-terra/40 bg-terra/5 px-4 py-3 text-sm text-terra" role="alert">{error}</div>}
      {notice && <div className="border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink" role="status">{notice}</div>}

      <div className="flex flex-wrap gap-1 border-b border-sand" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition',
              tab === t.id ? 'border-gold text-ink' : 'border-transparent text-ink-soft hover:text-ink',
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'team' && <ManagersPanel setError={setError} />}
      {tab === 'complaints' && <ComplaintsPanel setError={setError} setNotice={setNotice} />}
      {tab === 'reports' && <ReportsPanel />}
      {tab === 'security' && <SecurityPanel setError={setError} setNotice={setNotice} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Managers: roster cards + chat
// ---------------------------------------------------------------------------

function ManagersPanel({ setError }: { setError: (e: string | null) => void }) {
  const [active, setActive] = useState(MANAGERS[0].key);
  const [messages, setMessages] = useState<ManagerChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('manager_chats')
      .select('*')
      .eq('manager_key', active)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages((data as ManagerChatMessage[]) ?? []);
  }, [active]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!supabase || !draft.trim() || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('manager-chat', {
        body: { manager_key: active, message: text },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Message failed.');
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const meta = MANAGERS.find((m) => m.key === active)!;

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      {/* Roster */}
      <div className="space-y-2">
        {MANAGERS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setActive(m.key)}
            className={cn(
              'card-playbill w-full p-3 text-left transition',
              active === m.key ? 'border-gold bg-gold/5' : 'hover:border-gold/40',
            )}
          >
            <p className="text-sm font-semibold text-ink">{m.name}</p>
            <p className="text-xs font-medium text-gold-deep">{m.title}</p>
            <p className="mt-1 text-xs leading-snug text-ink-soft">{m.portfolio}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-soft/70">{m.hoursLabel}</p>
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="card-playbill flex min-h-[28rem] flex-col">
        <div className="border-b border-sand px-4 py-3">
          <p className="text-sm font-semibold text-ink">{meta.name} — {meta.title}</p>
          <p className="text-xs text-ink-soft">{meta.hoursLabel}</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-soft">
              No messages yet. Brief {meta.name.split(' ')[0]} on what you need.
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn('flex', m.sender === 'ceo' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] border px-3 py-2 text-sm',
                  m.sender === 'ceo'
                    ? 'border-gold/40 bg-gold/10 text-ink'
                    : 'border-sand bg-neutral-50 text-ink',
                )}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                <p className="mt-1 text-[10px] text-ink-soft/70">
                  {m.sender === 'ceo' ? 'You' : meta.name} · {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2 border-t border-sand p-3">
          <input
            className="input-stage flex-1"
            placeholder={`Message ${meta.name.split(' ')[0]}…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
          />
          <button type="button" className="btn-gold flex items-center gap-2" disabled={sending || !draft.trim()} onClick={() => void send()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Complaints pipeline: HR log -> Quality comment -> CEO comment -> meeting flag
// ---------------------------------------------------------------------------

function ComplaintsPanel({ setError, setNotice }: { setError: (e: string | null) => void; setNotice: (n: string | null) => void }) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  type DraftKeys = 'quality' | 'ceo' | 'hr';
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<DraftKeys, string>>>>({});

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('complaints')
      .select('*, profiles:reporter_id(full_name, email, role)')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    setComplaints((data as Complaint[]) ?? []);
    setLoading(false);
  }, [setError]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (c: Complaint, patch: Partial<Complaint>, msg: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('complaints').update(patch).eq('id', c.id);
    if (error) setError(error.message);
    else {
      setNotice(msg);
      await load();
    }
  };

  if (loading) return <p className="text-sm text-ink-soft">Loading complaints…</p>;

  return (
    <section className="space-y-4">
      <p className="text-sm text-ink-soft">
        The pipeline: HR logs it, the Quality Specialist analyses it, you decide — and flag what goes
        to the tutors' or learners' meeting.
      </p>
      {complaints.length === 0 && (
        <div className="card-playbill p-6 text-center text-sm text-ink-soft">No complaints logged. The floor is quiet.</div>
      )}
      {complaints.map((c) => (
        <article key={c.id} className="card-playbill p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-sand bg-neutral-50 px-2 py-0.5 text-xs font-medium capitalize text-ink-soft">{c.category}</span>
            <span className="border border-sand bg-neutral-50 px-2 py-0.5 text-xs font-medium text-ink-soft">
              {c.audience === 'hr' ? 'HR (tutor)' : 'Learner Success'}
            </span>
            <span
              className={cn(
                'border px-2 py-0.5 text-xs font-semibold capitalize',
                c.status === 'open' && 'border-terra/40 bg-terra/5 text-terra',
                c.status === 'in_progress' && 'border-gold/40 bg-gold/10 text-gold-deep',
                c.status === 'resolved' && 'border-sage/50 bg-sage/10 text-sage-deep',
              )}
            >
              {c.status.replace('_', ' ')}
            </span>
            {c.flag_for_meeting && (
              <span className="inline-flex items-center gap-1 border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold-deep">
                <Flag className="h-3 w-3" aria-hidden="true" /> {c.meeting_target === 'learners' ? "Learners' meeting" : "Tutors' meeting"}
              </span>
            )}
            <span className="ml-auto text-xs text-ink-soft">{new Date(c.created_at).toLocaleString()}</span>
          </div>

          <h3 className="mt-2 font-semibold text-ink">{c.subject}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{c.body}</p>
          <p className="mt-1 text-xs text-ink-soft">
            — {c.profiles?.full_name ?? 'Member'} ({c.profiles?.email}) · {c.profiles?.role === 'teacher' ? 'tutor' : 'learner'}
          </p>

          {/* Workflow comments */}
          <div className="mt-4 grid gap-3 border-t border-sand pt-3 md:grid-cols-3">
            {(
              [
                { key: 'hr', label: 'HR notes', field: 'hr_notes' },
                { key: 'quality', label: 'Quality Specialist comment', field: 'quality_comment' },
                { key: 'ceo', label: 'Your comment (CEO)', field: 'ceo_comment' },
              ] as { key: DraftKeys; label: string; field: 'hr_notes' | 'quality_comment' | 'ceo_comment' }[]
            ).map(({ key, label, field }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-semibold text-ink">{label}</label>
                <textarea
                  className="input-stage min-h-16 text-xs"
                  defaultValue={c[field] ?? ''}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [c.id]: { ...d[c.id], [key]: e.target.value } }))
                  }
                />
                <button
                  type="button"
                  className="btn-ghost mt-1 px-2.5 py-1 text-xs"
                  onClick={() => void update(c, { [field]: drafts[c.id]?.[key] ?? c[field] ?? '' } as Partial<Complaint>, `${label} saved.`)}
                >
                  Save
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-sand pt-3">
            <span className="text-xs font-semibold text-ink">Status:</span>
            {(['open', 'in_progress', 'resolved'] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={cn('btn-ghost px-2.5 py-1 text-xs', c.status === st && 'border-gold text-gold-deep')}
                onClick={() => void update(c, { status: st }, 'Status updated.')}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
            <span className="mx-2 h-4 w-px bg-sand" />
            <span className="text-xs font-semibold text-ink">Raise in meeting:</span>
            <button
              type="button"
              className={cn('btn-ghost px-2.5 py-1 text-xs', c.flag_for_meeting && c.meeting_target === 'tutors' && 'border-gold text-gold-deep')}
              onClick={() => void update(c, { flag_for_meeting: true, meeting_target: 'tutors' }, "Flagged for the tutors' meeting.")}
            >
              Tutors — yes
            </button>
            <button
              type="button"
              className={cn('btn-ghost px-2.5 py-1 text-xs', c.flag_for_meeting && c.meeting_target === 'learners' && 'border-gold text-gold-deep')}
              onClick={() => void update(c, { flag_for_meeting: true, meeting_target: 'learners' }, "Flagged for the learners' meeting.")}
            >
              Learners — yes
            </button>
            <button
              type="button"
              className={cn('btn-ghost px-2.5 py-1 text-xs', !c.flag_for_meeting && 'border-sand text-ink')}
              onClick={() => void update(c, { flag_for_meeting: false, meeting_target: null }, 'Removed from the meeting agenda.')}
            >
              No
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Reports inbox
// ---------------------------------------------------------------------------

function ReportsPanel() {
  const [reports, setReports] = useState<ManagerReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from('manager_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);
      setReports((data as ManagerReport[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-ink-soft">Loading reports…</p>;

  return (
    <section className="space-y-4">
      <p className="text-sm text-ink-soft">
        Managers file their reports every Saturday; the Head of Security files the security &amp;
        performance report every Sunday.
      </p>
      {reports.length === 0 && (
        <div className="card-playbill p-6 text-center text-sm text-ink-soft">
          No reports filed yet — the first batch lands on Saturday.
        </div>
      )}
      {reports.map((r) => {
        const meta = MANAGERS.find((m) => m.key === r.manager_key);
        return (
          <article key={r.id} className="card-playbill p-5">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="font-semibold text-ink">{r.title}</h3>
              <span className="text-xs text-ink-soft">
                {meta ? `${meta.name} · ` : ''}filed {new Date(r.created_at).toLocaleString()}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{r.body}</p>
          </article>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Security: the Red Button panel
// ---------------------------------------------------------------------------

const SWITCHES: { key: keyof PlatformFlags; label: string; description: string; danger: boolean }[] = [
  {
    key: 'lockdown',
    label: 'FULL PLATFORM LOCKDOWN',
    description: 'The fire-alarm switch. Everyone except you is locked out instantly. Use only on CSO advice during an active incident.',
    danger: true,
  },
  {
    key: 'signups_disabled',
    label: 'Freeze new signups',
    description: 'Stops new account creation. Existing members are unaffected.',
    danger: false,
  },
  {
    key: 'payments_disabled',
    label: 'Freeze payments',
    description: 'Blocks new proof-of-payment submissions. Existing bookings are unaffected.',
    danger: false,
  },
];

function SecurityPanel({ setError, setNotice }: { setError: (e: string | null) => void; setNotice: (n: string | null) => void }) {
  const flags = usePlatformFlags();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmLockdown, setConfirmLockdown] = useState(false);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [transcript, setTranscript] = useState<{ event: SecurityEvent; chats: LibraryChat[] } | null>(null);

  const loadEvents = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('security_events')
      .select('*, profiles:user_id(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(50);
    setEvents((data as SecurityEvent[]) ?? []);
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const openTranscript = async (event: SecurityEvent) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('library_chats')
      .select('*')
      .eq('user_id', event.user_id)
      .order('created_at', { ascending: true })
      .limit(100);
    setTranscript({ event, chats: (data as LibraryChat[]) ?? [] });
  };

  const release = async (event: SecurityEvent) => {
    if (!supabase) return;
    setBusy(event.id);
    await supabase
      .from('profiles')
      .update({ library_hold_until: null, library_hold_reason: null })
      .eq('id', event.user_id);
    await supabase
      .from('security_events')
      .update({ status: 'cleared', resolved_at: new Date().toISOString(), resolution_note: 'Cleared by CEO after review.' })
      .eq('id', event.id);
    setNotice('Member released and event cleared.');
    await loadEvents();
    setBusy(null);
  };

  const escalate = async (event: SecurityEvent) => {
    if (!supabase) return;
    setBusy(event.id);
    await supabase.from('profiles').update({ safe_room: true }).eq('id', event.user_id);
    await supabase
      .from('security_events')
      .update({ status: 'escalated', resolved_at: new Date().toISOString(), resolution_note: 'Escalated to the safe room by CEO.' })
      .eq('id', event.id);
    setNotice('Escalated — the member is now in the safe room.');
    await loadEvents();
    setBusy(null);
  };

  const flip = async (key: keyof PlatformFlags, value: boolean) => {
    if (!supabase) return;
    setBusy(key);
    const { error } = await supabase
      .from('platform_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) setError(error.message);
    else {
      setNotice(
        value
          ? `${SWITCHES.find((s) => s.key === key)?.label} is now ACTIVE.`
          : `${SWITCHES.find((s) => s.key === key)?.label} lifted.`,
      );
      if (key === 'lockdown') setConfirmLockdown(false);
    }
    setBusy(null);
  };

  return (
    <section className="space-y-4">
      <div className="card-playbill p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <ShieldAlert className="h-5 w-5 text-gold-deep" aria-hidden="true" /> Security operations
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Sibusiso Nkosi (Head of Security) runs 17 automated IT-specialist checks continuously and files
          the Sunday security report. If an incident breaks out, ask him first — then act here. For
          individual troublemakers, use the safe room and suspension tools in the Office.
        </p>
      </div>

      {SWITCHES.map((sw) => {
        const active = flags[sw.key];
        const needsConfirm = sw.danger && !active && !confirmLockdown;
        return (
          <div
            key={sw.key}
            className={cn(
              'border p-5',
              active ? 'border-terra bg-terra/5' : sw.danger ? 'border-terra/40 bg-white' : 'border-sand bg-white',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={cn('font-semibold', sw.danger ? 'text-terra-deep' : 'text-ink')}>
                  {sw.label}
                  {active && <span className="ml-2 border border-terra bg-terra px-2 py-0.5 text-xs font-bold text-white">ACTIVE</span>}
                </p>
                <p className="mt-1 max-w-xl text-sm text-ink-soft">{sw.description}</p>
              </div>
              {needsConfirm ? (
                <button
                  type="button"
                  className="flex items-center gap-2 border border-terra bg-white px-4 py-2 text-sm font-semibold text-terra-deep"
                  onClick={() => setConfirmLockdown(true)}
                >
                  <Lock className="h-4 w-4" aria-hidden="true" /> Arm lockdown
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy === sw.key}
                  onClick={() => void flip(sw.key, !active)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50',
                    sw.danger
                      ? active
                        ? 'border border-sage bg-sage'
                        : 'border border-terra bg-terra hover:bg-terra-deep'
                      : 'btn-ghost',
                  )}
                >
                  {busy === sw.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : active ? (
                    <Unlock className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  )}
                  {active ? 'Lift' : sw.danger ? 'CONFIRM LOCKDOWN' : 'Activate'}
                </button>
              )}
            </div>
            {sw.danger && confirmLockdown && !active && (
              <p className="mt-3 border-t border-terra/30 pt-3 text-sm text-terra-deep">
                Press CONFIRM LOCKDOWN to lock the platform. Only your account keeps access until you lift it.
              </p>
            )}
          </div>
        );
      })}

      {/* Intelligence console */}
      <div className="card-playbill p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <Activity className="h-5 w-5 text-gold-deep" aria-hidden="true" /> Intelligence console
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          The 17 automated checks record evidence snapshots here. A repeat pattern places the member in
          the Library (soft hold, 4 hours, auto-release) where a field interviewer runs a routine survey.
          You review the transcript and decide: release or escalate. Nobody is banned on suspicion alone.
        </p>

        {events.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No security events recorded. The platform is quiet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-sand">
            {events.map((ev) => (
              <li key={ev.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'border px-2 py-0.5 text-xs font-semibold',
                      ev.severity === 'hold' && 'border-gold/40 bg-gold/10 text-gold-deep',
                      ev.severity === 'watch' && 'border-sand bg-neutral-50 text-ink-soft',
                      ev.severity === 'critical' && 'border-terra/40 bg-terra/5 text-terra',
                    )}
                  >
                    {ev.severity}
                  </span>
                  <span className="font-mono text-xs text-ink">{ev.signal}</span>
                  <span
                    className={cn(
                      'border px-2 py-0.5 text-xs capitalize',
                      ev.status === 'open' && 'border-terra/40 text-terra',
                      ev.status === 'survey_sent' && 'border-gold/40 text-gold-deep',
                      ev.status === 'cleared' && 'border-sage/50 text-sage-deep',
                      ev.status === 'escalated' && 'border-terra bg-terra/10 text-terra-deep',
                    )}
                  >
                    {ev.status.replace('_', ' ')}
                  </span>
                  <span className="ml-auto text-xs text-ink-soft">{new Date(ev.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm text-ink">
                  {ev.profiles?.full_name ?? 'Member'} <span className="text-ink-soft">({ev.profiles?.email})</span>
                </p>
                <p className="mt-0.5 font-mono text-xs text-ink-soft">{JSON.stringify(ev.detail)}</p>
                {(ev.status === 'open' || ev.status === 'survey_sent') && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => void openTranscript(ev)}>
                      Read survey transcript
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1 text-xs text-sage-deep"
                      disabled={busy === ev.id}
                      onClick={() => void release(ev)}
                    >
                      Release member
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1 text-xs text-terra-deep"
                      disabled={busy === ev.id}
                      onClick={() => void escalate(ev)}
                    >
                      Escalate to safe room
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Transcript modal */}
      {transcript && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-playbill max-h-[80vh] w-full max-w-xl overflow-y-auto p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink">
                Survey transcript — {transcript.event.profiles?.full_name ?? 'member'}
              </h3>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setTranscript(null)}>
                Close
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {transcript.chats.length === 0 && (
                <p className="text-sm text-ink-soft">The member has not responded to the survey yet.</p>
              )}
              {transcript.chats.map((m) => (
                <div key={m.id} className={m.sender === 'member' ? 'text-right' : ''}>
                  <p
                    className={cn(
                      'inline-block max-w-[85%] border px-3 py-2 text-left text-sm',
                      m.sender === 'member' ? 'border-gold/40 bg-gold/10' : 'border-sand bg-neutral-50',
                    )}
                  >
                    <span className="block text-[10px] font-semibold text-ink-soft">
                      {m.sender === 'member' ? 'Member' : 'Field interviewer'}
                    </span>
                    {m.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
