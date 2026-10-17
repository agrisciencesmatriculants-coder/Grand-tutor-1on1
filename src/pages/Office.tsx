import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  Building2,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  GraduationCap,
  Presentation,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Broadcast, Payment, Profile, PayoutRequest, TelegraphScriptRow, VarsityOffering, VpLedgerEntry } from '../lib/types';
import { formatRand } from '../lib/vp';
import ApplicationsPanel from '../features/office/ApplicationsPanel';
import { cn } from '../lib/utils';

const OWNER_EMAIL = 'youngagripreneurs.ng@gmail.com';

type Tab = 'dashboard' | 'applications' | 'tutors' | 'moderation' | 'money';

interface Stats {
  learners: number;
  tutors: number;
  suspended: number;
  scripts: number;
  broadcasts: number;
  pendingModeration: number;
  quizAttempts: number;
  vpIssued: number;
  revenueCents: number;
  pendingPayments: number;
}

export default function Office() {
  const { profile } = useAuth();
  const isAdmin = profile?.email === OWNER_EMAIL;
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingApps, setPendingApps] = useState(0);
  const [whatsappRequests, setWhatsappRequests] = useState<Profile[]>([]);
  const [safeRoomMembers, setSafeRoomMembers] = useState<Profile[]>([]);
  const [safeRoomEmail, setSafeRoomEmail] = useState('');
  const [tutors, setTutors] = useState<Profile[]>([]);
  const [scripts, setScripts] = useState<TelegraphScriptRow[]>([]);
  const [ledger, setLedger] = useState<VpLedgerEntry[]>([]);
  const [pendingBroadcasts, setPendingBroadcasts] = useState<Broadcast[]>([]);
  const [pendingOfferings, setPendingOfferings] = useState<VarsityOffering[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const headCount = async (table: string, filters?: Record<string, string | boolean>) => {
        let q = supabase!.from(table).select('id', { count: 'exact', head: true });
        if (filters) {
          for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
        }
        const { count: c } = await q;
        return c ?? 0;
      };

      const [learners, tutorsN, suspended, scriptsN, broadcastsN, quizAttempts, pendingPay] = await Promise.all([
        headCount('profiles', { role: 'student' }),
        headCount('profiles', { role: 'teacher' }),
        headCount('profiles', { suspended: true }),
        headCount('telegraph_scripts'),
        headCount('broadcasts'),
        headCount('quiz_attempts'),
        headCount('payments', { status: 'pending' }),
      ]);
      const { count: pendingApplications } = await supabase
        .from('tutor_applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['submitted', 'in_review']);
      setPendingApps(pendingApplications ?? 0);
      const { data: waRows } = await supabase
        .from('profiles')
        .select('*')
        .eq('whatsapp_code_requested', true);
      setWhatsappRequests((waRows ?? []) as Profile[]);
      const { data: srRows } = await supabase
        .from('profiles')
        .select('*')
        .eq('safe_room', true);
      setSafeRoomMembers((srRows ?? []) as Profile[]);

      const [
        { data: tutorRows },
        { data: scriptRows },
        { data: ledgerRows },
        { data: bcRows },
        { data: offRows },
        { data: payRows },
        { data: payoutRows },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'teacher').order('created_at', { ascending: false }),
        supabase.from('telegraph_scripts').select('id, tutor_id, title, created_at'),
        supabase.from('vp_ledger').select('*').limit(2000),
        supabase.from('broadcasts').select('*, telegraph_scripts(*)').eq('approved', false).order('airs_at'),
        supabase.from('varsity_offerings').select('*, profiles:tutor_id(full_name)').eq('approved', false),
        supabase.from('payments').select('*, bookings(reference, scheduled_at)').order('created_at', { ascending: false }).limit(100),
        supabase.from('payout_requests').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      const ledgerList = (ledgerRows ?? []) as VpLedgerEntry[];
      const payList = (payRows ?? []) as Payment[];

      setTutors((tutorRows ?? []) as Profile[]);
      setScripts((scriptRows ?? []) as TelegraphScriptRow[]);
      setLedger(ledgerList);
      setPendingBroadcasts((bcRows ?? []) as Broadcast[]);
      setPendingOfferings((offRows ?? []) as VarsityOffering[]);
      setPayments(payList);
      setPayouts((payoutRows ?? []) as PayoutRequest[]);

      setStats({
        learners,
        tutors: tutorsN,
        suspended,
        scripts: scriptsN,
        broadcasts: broadcastsN,
        pendingModeration: (bcRows?.length ?? 0) + (offRows?.length ?? 0),
        quizAttempts,
        vpIssued: ledgerList.reduce((n, e) => n + e.amount, 0),
        revenueCents: payList.filter((p) => p.status === 'approved').reduce((n, p) => n + p.amount_cents, 0),
        pendingPayments: pendingPay,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load office data.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSuspend = useCallback(
    async (tutor: Profile) => {
      if (!supabase) return;
      setBusy(true);
      const { error: err } = await supabase
        .from('profiles')
        .update({ suspended: !tutor.suspended })
        .eq('id', tutor.id);
      if (err) setError(err.message);
      else {
        setNotice(tutor.suspended ? 'Tutor reinstated.' : 'Tutor suspended — they can no longer record or schedule lessons.');
        await load();
      }
      setBusy(false);
    },
    [load],
  );

  const toggleSafeRoom = useCallback(
    async (member: Profile) => {
      if (!supabase) return;
      setBusy(true);
      const { error: err } = await supabase
        .from('profiles')
        .update({ safe_room: !member.safe_room })
        .eq('id', member.id);
      if (err) setError(err.message);
      else {
        setNotice(member.safe_room ? 'Member released from the safe room.' : 'Member moved to the safe room — they see a calm review page only.');
        await load();
      }
      setBusy(false);
    },
    [load],
  );

  const moveToSafeRoomByEmail = useCallback(async () => {
    if (!supabase || !safeRoomEmail.trim()) return;
    setBusy(true);
    const { data, error: err } = await supabase
      .from('profiles')
      .update({ safe_room: true })
      .eq('email', safeRoomEmail.trim().toLowerCase())
      .select('id');
    if (err) setError(err.message);
    else if (!data || data.length === 0) setError('No account with that email address.');
    else {
      setNotice('Member moved to the safe room.');
      setSafeRoomEmail('');
      await load();
    }
    setBusy(false);
  }, [safeRoomEmail, load]);

  const clearWhatsappRequest = useCallback(
    async (member: Profile) => {
      if (!supabase) return;
      await supabase.from('profiles').update({ whatsapp_code_requested: false }).eq('id', member.id);
      setNotice(`Marked as handled — send the code to ${member.whatsapp_number ?? 'their number'} via WhatsApp first.`);
      await load();
    },
    [load],
  );

  const approve = useCallback(
    async (table: 'broadcasts' | 'varsity_offerings', id: string) => {
      if (!supabase) return;
      setBusy(true);
      const { error: err } = await supabase.from(table).update({ approved: true }).eq('id', id);
      if (err) setError(err.message);
      else {
        setNotice('Approved — now visible on the platform.');
        await load();
      }
      setBusy(false);
    },
    [load],
  );

  const scriptsPerTutor = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of scripts) {
      if (s.tutor_id) m.set(s.tutor_id, (m.get(s.tutor_id) ?? 0) + 1);
    }
    return m;
  }, [scripts]);

  const vpPerTutor = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of ledger) m.set(e.tutor_id, (m.get(e.tutor_id) ?? 0) + e.amount);
    return m;
  }, [ledger]);

  if (!isAdmin) {
    return (
      <div className="card-playbill mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-bold text-ink">Office</h1>
        <p className="mt-2 text-sm text-ink-soft">This page is for the platform owner only.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'applications', label: 'Applications', badge: pendingApps },
    { id: 'tutors', label: 'Tutors' },
    { id: 'moderation', label: 'Moderation', badge: stats?.pendingModeration },
    { id: 'money', label: 'Money', badge: stats?.pendingPayments },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
          <Building2 className="h-6 w-6 text-gold-deep" aria-hidden="true" />
          CEO Office
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Platform oversight: users, tutors, content moderation, and money. Everything that keeps
          VukaTV legitimate runs from here.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-terra/40 bg-terra-tint px-4 py-3 text-sm text-terra-deep" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-sage/50 bg-sage/10 px-4 py-3 text-sm text-ink" role="status">
          {notice}
        </div>
      )}

      {/* Tabs */}
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
              tab === t.id
                ? 'border-gold text-ink'
                : 'border-transparent text-ink-soft hover:text-ink',
            )}
          >
            {t.label}
            {typeof t.badge === 'number' && t.badge > 0 && (
              <span className="rounded-full bg-terra px-1.5 py-0.5 text-[10px] font-bold text-white">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading || !stats ? (
        <p className="text-sm text-ink-soft">Loading office data…</p>
      ) : tab === 'dashboard' ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<GraduationCap className="h-4 w-4" />} label="Learners" value={String(stats.learners)} />
          <StatCard icon={<Presentation className="h-4 w-4" />} label="Tutors" value={`${stats.tutors}${stats.suspended ? ` (${stats.suspended} suspended)` : ''}`} />
          <StatCard icon={<Radio className="h-4 w-4" />} label="Lessons recorded" value={String(stats.scripts)} />
          <StatCard icon={<ClipboardCheck className="h-4 w-4" />} label="Broadcasts" value={String(stats.broadcasts)} />
          <StatCard icon={<Users className="h-4 w-4" />} label="Quiz attempts" value={String(stats.quizAttempts)} />
          <StatCard icon={<CircleDollarSign className="h-4 w-4" />} label="VP issued" value={stats.vpIssued.toLocaleString('en-ZA')} />
          <StatCard icon={<Banknote className="h-4 w-4" />} label="Approved revenue" value={formatRand(stats.revenueCents / 100)} />
          <StatCard icon={<ShieldAlert className="h-4 w-4" />} label="Awaiting moderation" value={String(stats.pendingModeration)} />
        </section>
      ) : tab === 'applications' ? (
        <ApplicationsPanel onChanged={load} setError={setError} setNotice={setNotice} />
      ) : tab === 'tutors' ? (
        <div className="space-y-6">
        <section className="card-playbill overflow-x-auto p-5">
          <h2 className="text-lg font-semibold text-ink">Tutor management</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Suspended tutors keep their account but cannot record lessons, schedule broadcasts, or
            offer paid sessions.
          </p>
          <table className="mt-4 w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-sand text-xs uppercase tracking-wide text-ink-soft">
                <th className="py-2 pr-4 font-medium">Tutor</th>
                <th className="py-2 pr-4 font-medium">Joined</th>
                <th className="py-2 pr-4 font-medium">Lessons</th>
                <th className="py-2 pr-4 font-medium">VP balance</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {tutors.map((t) => (
                <tr key={t.id}>
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-ink">{t.full_name ?? 'Unnamed'}</p>
                    <p className="text-xs text-ink-soft">{t.email}</p>
                  </td>
                  <td className="py-2.5 pr-4 text-ink-soft">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="py-2.5 pr-4 text-ink">{scriptsPerTutor.get(t.id) ?? 0}</td>
                  <td className="py-2.5 pr-4 font-mono text-ink">{(vpPerTutor.get(t.id) ?? 0).toLocaleString('en-ZA')}</td>
                  <td className="py-2.5 pr-4">
                    <div className="flex flex-col gap-1">
                      {t.suspended ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-terra-tint px-2 py-0.5 text-xs font-semibold text-terra-deep">
                          <ShieldAlert className="h-3 w-3" aria-hidden="true" /> Suspended
                        </span>
                      ) : (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-sage-tint px-2 py-0.5 text-xs font-semibold text-sage-deep">
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Active
                        </span>
                      )}
                      {t.safe_room && (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-gold-tint px-2 py-0.5 text-xs font-semibold text-gold-deep">
                          Safe room
                        </span>
                      )}
                      {!t.code_verified && (
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-ink-soft">
                          {t.verification_note ?? 'awaiting code'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5">
                    {t.email !== OWNER_EMAIL && (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleSuspend(t)}
                          className={cn(
                            'btn-ghost px-3 py-1 text-xs',
                            t.suspended ? 'text-sage-deep' : 'text-terra-deep',
                          )}
                        >
                          {t.suspended ? 'Reinstate' : 'Suspend'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleSafeRoom(t)}
                          className="btn-ghost px-3 py-1 text-xs text-gold-deep"
                        >
                          {t.safe_room ? 'Release from safe room' : 'Move to safe room'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {tutors.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-soft">No tutors yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card-playbill p-5">
          <h2 className="text-lg font-semibold text-ink">WhatsApp code requests</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Members who failed the email code 3 times and asked for WhatsApp delivery. Send the code
            manually, then mark as handled.
          </p>
          {whatsappRequests.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No open requests.</p>
          ) : (
            <ul className="mt-3 divide-y divide-sand">
              {whatsappRequests.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="flex-1 text-ink">
                    {m.full_name ?? 'Unnamed'} — <span className="font-mono">{m.whatsapp_number ?? 'no number on file'}</span>
                  </span>
                  <span className="text-xs text-ink-soft">{m.email}</span>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1 text-xs"
                    disabled={busy}
                    onClick={() => void clearWhatsappRequest(m)}
                  >
                    Mark as handled
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-playbill p-5">
          <h2 className="text-lg font-semibold text-ink">Safe room</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Members in the safe room see a calm review page and cannot use the platform. Move anyone
            here by email the moment something looks wrong — release them when it is resolved.
          </p>
          <div className="mt-3 flex max-w-md gap-2">
            <input
              className="input-stage flex-1"
              placeholder="member@email.com"
              value={safeRoomEmail}
              onChange={(e) => setSafeRoomEmail(e.target.value)}
              aria-label="Move member to safe room by email"
            />
            <button
              type="button"
              className="btn-ghost text-gold-deep"
              disabled={busy || !safeRoomEmail.trim()}
              onClick={() => void moveToSafeRoomByEmail()}
            >
              Move to safe room
            </button>
          </div>
          {safeRoomMembers.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">The safe room is empty.</p>
          ) : (
            <ul className="mt-3 divide-y divide-sand">
              {safeRoomMembers.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="flex-1 text-ink">{m.full_name ?? 'Unnamed'}</span>
                  <span className="text-xs text-ink-soft">{m.email} · {m.role === 'teacher' ? 'tutor' : 'learner'}</span>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1 text-xs text-sage-deep"
                    disabled={busy}
                    onClick={() => void toggleSafeRoom(m)}
                  >
                    Release
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
      ) : tab === 'moderation' ? (
        <div className="space-y-6">
          <section className="card-playbill p-5">
            <h2 className="text-lg font-semibold text-ink">Broadcasts awaiting approval</h2>
            <p className="mt-1 text-sm text-ink-soft">
              New public broadcasts stay hidden from the VukaTV guide until you approve them.
            </p>
            {pendingBroadcasts.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">Nothing waiting.</p>
            ) : (
              <ul className="mt-3 divide-y divide-sand">
                {pendingBroadcasts.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{b.title ?? b.telegraph_scripts?.title ?? 'Broadcast'}</p>
                      <p className="text-xs text-ink-soft">
                        {b.telegraph_scripts?.subject ?? 'No subject'} · airs {new Date(b.airs_at).toLocaleString()}
                      </p>
                    </div>
                    <Link to={`/tv/${b.id}`} className="btn-ghost px-3 py-1.5 text-xs">
                      Watch first
                    </Link>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void approve('broadcasts', b.id)}
                      className="btn-gold flex items-center gap-1 px-3 py-1.5 text-xs"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Approve
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-playbill p-5">
            <h2 className="text-lg font-semibold text-ink">Varsity offerings awaiting approval</h2>
            {pendingOfferings.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">Nothing waiting.</p>
            ) : (
              <ul className="mt-3 divide-y divide-sand">
                {pendingOfferings.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{o.title}</p>
                      <p className="text-xs text-ink-soft">
                        {o.profiles?.full_name ?? 'Tutor'} · {o.subject ?? 'No subject'} · {formatRand(o.price_cents / 100)} · {o.duration_min} min
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void approve('varsity_offerings', o.id)}
                      className="btn-gold flex items-center gap-1 px-3 py-1.5 text-xs"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Approve
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        /* Money tab */
        <div className="space-y-6">
          <section className="card-playbill p-5">
            <h2 className="text-lg font-semibold text-ink">Payments</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Approve or reject proof-of-payment uploads on the{' '}
              <Link to="/approvals" className="font-medium text-gold-deep underline">Approvals page</Link>.
            </p>
            <p className="mt-3 text-sm text-ink">
              <span className="font-semibold">{formatRand(stats.revenueCents / 100)}</span> approved revenue ·{' '}
              <span className={cn('font-semibold', stats.pendingPayments > 0 && 'text-terra-deep')}>
                {stats.pendingPayments} awaiting review
              </span>
            </p>
            <ul className="mt-3 divide-y divide-sand">
              {payments.slice(0, 10).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="flex-1 text-ink">
                    {formatRand(p.amount_cents / 100)} — Ref {p.bookings?.reference ?? '—'}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
                      p.status === 'approved'
                        ? 'bg-sage-tint text-sage-deep'
                        : p.status === 'pending'
                          ? 'bg-gold-tint text-gold-deep'
                          : 'bg-terra-tint text-terra-deep',
                    )}
                  >
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card-playbill p-5">
            <h2 className="text-lg font-semibold text-ink">VP payout requests</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Tutor VP payouts are manual EFT, managed on the{' '}
              <Link to="/points" className="font-medium text-gold-deep underline">Points page</Link>.
            </p>
            {payouts.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">No payout requests yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-sand">
                {payouts.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="flex-1 text-ink">
                      {formatRand(p.amount_cents / 100)} — {p.vp_total.toLocaleString('en-ZA')} VP ({p.period})
                    </span>
                    <span className="rounded-full bg-ivory-deep px-2 py-0.5 text-xs font-semibold capitalize text-ink-soft">
                      {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card-playbill p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
        {icon} {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
