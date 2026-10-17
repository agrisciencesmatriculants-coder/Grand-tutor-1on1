import { useCallback, useEffect, useState } from 'react';
import { Award, Banknote, Check, CircleDollarSign, Clock, TrendingUp, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { PayoutRequest, PayoutStatus, VpLedgerEntry } from '../lib/types';
import { estimatePayoutRand, formatRand, nextTier, reachedTier, VP_TIERS } from '../lib/vp';
import { cn } from '../lib/utils';

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const STATUS_STYLES: Record<PayoutStatus, string> = {
  pending: 'bg-sand/60 text-ink-soft',
  approved: 'bg-gold/15 text-gold-deep',
  paid: 'bg-sage/20 text-sage',
  rejected: 'bg-terracotta/15 text-terracotta',
};

export default function Points() {
  const { profile, role } = useAuth();
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<VpLedgerEntry[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isTeacher = role === 'teacher';
  const period = currentPeriod();

  const load = useCallback(async () => {
    if (!supabase || !profile) return;
    setLoading(true);
    const { data: entries } = await supabase
      .from('vp_ledger')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    const rows = (entries ?? []) as VpLedgerEntry[];
    setLedger(rows);
    setBalance(rows.reduce((n, r) => n + r.amount, 0));
    const { data: pr } = await supabase
      .from('payout_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(24);
    setPayouts((pr ?? []) as PayoutRequest[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const tier = reachedTier(balance);
  const next = nextTier(balance);
  const estimate = estimatePayoutRand(balance);
  const requestedThisPeriod = payouts.some((p) => p.period === period && p.tutor_id === profile?.id);

  // Payout forecast: VP rate over the last 30 days projected to month-end.
  const forecast = (() => {
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    const recent = ledger.filter((e) => new Date(e.created_at).getTime() >= cutoff);
    const recentVp = recent.reduce((n, e) => n + e.amount, 0);
    const dailyRate = recentVp / 30;
    const now = new Date();
    const daysLeft = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).getTime() - now.getTime();
    const projected = Math.round(balance + dailyRate * (daysLeft / (24 * 3600 * 1000)));
    return { projected, dailyRate, projectedRand: estimatePayoutRand(projected) };
  })();

  const requestPayout = useCallback(async () => {
    if (!supabase || !profile || estimate <= 0) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('payout_requests').insert({
      tutor_id: profile.id,
      period,
      vp_total: balance,
      amount_cents: estimate * 100,
    });
    if (err) setError(err.message);
    else {
      setNotice('Payout request submitted for manual EFT review.');
      await load();
    }
    setBusy(false);
  }, [balance, estimate, load, period, profile]);

  const review = useCallback(
    async (id: string, status: PayoutStatus) => {
      if (!supabase || !profile) return;
      setBusy(true);
      setError(null);
      const { error: err } = await supabase
        .from('payout_requests')
        .update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (err) setError(err.message);
      else await load();
      setBusy(false);
    },
    [load, profile],
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-ink">
          <Award className="h-6 w-6 text-gold-deep" aria-hidden="true" />
          Vuka Points
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Tutors earn VP when learners improve on lesson quizzes. VP converts to a monthly EFT
          payout on a fixed staircase.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-sage/50 bg-sage/10 px-4 py-3 text-sm text-ink" role="status">
          {notice}
        </div>
      )}

      {/* Balance + staircase */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="card-playbill p-5">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> Balance
          </p>
          <p className="font-display mt-1 text-3xl font-bold text-ink">
            {loading ? '…' : balance.toLocaleString('en-ZA')} <span className="text-base text-ink-soft">VP</span>
          </p>
        </div>
        <div className="card-playbill p-5">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
            <CircleDollarSign className="h-3.5 w-3.5" aria-hidden="true" /> Estimated payout
          </p>
          <p className="font-display mt-1 text-3xl font-bold text-gold-deep">
            {loading ? '…' : formatRand(estimate)}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {tier
              ? `Tier reached: ${formatRand(tier.baseRand)} at ${tier.threshold.toLocaleString()} VP, plus R1 per 100 VP above it.`
              : 'Reach 5,000 VP to unlock the first tier (R50).'}
          </p>
        </div>
        <div className="card-playbill p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Monthly staircase</p>
          <ul className="mt-2 space-y-1.5">
            {VP_TIERS.map((t) => (
              <li key={t.threshold} className="flex items-center gap-2 text-sm">
                <Check
                  className={cn(
                    'h-4 w-4',
                    balance >= t.threshold ? 'text-sage' : 'text-ink-soft/30',
                  )}
                  aria-hidden="true"
                />
                <span className={balance >= t.threshold ? 'font-semibold text-ink' : 'text-ink-soft'}>
                  {t.threshold.toLocaleString()} VP → {formatRand(t.baseRand)}
                </span>
              </li>
            ))}
          </ul>
          {next && (
            <p className="mt-2 text-xs text-ink-soft">
              {(next.threshold - balance).toLocaleString()} VP to the next tier.
            </p>
          )}
        </div>
      </section>

      {/* Payout forecast */}
      <section className="card-playbill p-5">
        <h2 className="font-display flex items-center gap-2 text-lg font-semibold text-ink">
          <TrendingUp className="h-5 w-5 text-gold-deep" aria-hidden="true" /> Month-end forecast
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          At your current rate ({forecast.dailyRate.toFixed(1)} VP/day over the last 30 days), you
          are projected to reach{' '}
          <span className="font-semibold text-ink">{forecast.projected.toLocaleString('en-ZA')} VP</span>{' '}
          by month-end — an estimated payout of{' '}
          <span className="font-semibold text-gold-deep">{formatRand(forecast.projectedRand)}</span>.
        </p>
      </section>

      {/* Payout request */}
      <section className="card-playbill p-5">
        <h2 className="font-display flex items-center gap-2 text-lg font-semibold text-ink">
          <Banknote className="h-5 w-5 text-gold-deep" aria-hidden="true" /> Payouts
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Payouts are manual EFT. Submit a request for the current month; the owner approves it
          after transferring to your bank details on file.
        </p>
        {!isTeacher && !requestedThisPeriod && estimate > 0 && (
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void requestPayout()}
            className="btn-gold mt-3 px-4 py-2 text-sm disabled:opacity-60"
          >
            {busy ? 'Submitting…' : `Request ${formatRand(estimate)} for ${period}`}
          </button>
        )}
        {payouts.length > 0 && (
          <ul className="mt-4 divide-y divide-sand">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {formatRand(p.amount_cents / 100)} — {p.vp_total.toLocaleString()} VP ({p.period})
                  </p>
                  <p className="text-xs text-ink-soft">
                    Requested {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', STATUS_STYLES[p.status])}>
                  {p.status}
                </span>
                {isTeacher && p.status === 'pending' && (
                  <span className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void review(p.id, 'approved')}
                      className="btn-ghost flex items-center gap-1 px-2.5 py-1 text-xs text-sage"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void review(p.id, 'rejected')}
                      className="btn-ghost flex items-center gap-1 px-2.5 py-1 text-xs text-terracotta"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" /> Reject
                    </button>
                  </span>
                )}
                {isTeacher && p.status === 'approved' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void review(p.id, 'paid')}
                    className="btn-ghost flex items-center gap-1 px-2.5 py-1 text-xs text-sage"
                  >
                    <Banknote className="h-3.5 w-3.5" aria-hidden="true" /> Mark paid
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ledger */}
      <section className="card-playbill p-5">
        <h2 className="font-display text-lg font-semibold text-ink">Recent VP activity</h2>
        {loading ? (
          <p className="mt-2 text-sm text-ink-soft">Loading…</p>
        ) : ledger.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            No VP yet. Points arrive when learners improve on your lesson quizzes.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-sand">
            {ledger.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                <span className="font-mono text-sm font-semibold text-gold-deep">+{e.amount} VP</span>
                <span className="flex-1 text-sm text-ink-soft">Learner quiz improvement</span>
                <span className="flex items-center gap-1 text-xs text-ink-soft">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
