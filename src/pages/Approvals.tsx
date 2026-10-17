import { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardCheck, FileText, Landmark, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { BankDetails, Payment } from '../lib/types';
import { formatRand } from '../lib/vp';
import { cn } from '../lib/utils';

const OWNER_EMAIL = 'youngagripreneurs.ng@gmail.com';

/**
 * Admin (owner) approvals for manual EFT payments. Approve → booking confirmed
 * + Jitsi room unlocks + payer emailed. Reject (reason required) → booking
 * rejected + payer emailed. Also shows pending VP payout requests summary via
 * the Points page (payout approvals live there).
 */
export default function Approvals() {
  const { profile } = useAuth();
  const isAdmin = profile?.email === OWNER_EMAIL;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [bankDraft, setBankDraft] = useState<BankDetails>({ account_name: '', bank: '', account_number: '', branch_code: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    setLoading(true);
    const { data } = await supabase
      .from('payments')
      .select('*, bookings(*, varsity_offerings(title, subject)), profiles:payer_id(email, full_name)')
      .order('created_at', { ascending: false })
      .limit(100);
    setPayments((data ?? []) as Payment[]);
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'bank_details')
      .maybeSingle();
    if (settings?.value) {
      setBank(settings.value as BankDetails);
      setBankDraft(settings.value as BankDetails);
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const viewProof = useCallback(async (p: Payment) => {
    if (!supabase) return;
    const { data, error: err } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(p.proof_path, 300);
    if (err || !data) {
      setError(err?.message ?? 'Could not open the proof file.');
      return;
    }
    setProofUrls((m) => ({ ...m, [p.id]: data.signedUrl }));
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const decide = useCallback(
    async (paymentId: string, action: 'approve' | 'reject', reason = '') => {
      if (!supabase) return;
      setBusy(true);
      setError(null);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('review-payment', {
          body: { payment_id: paymentId, action, reason },
        });
        if (fnErr) throw new Error(fnErr.message ?? 'Review failed.');
        if (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)) {
          throw new Error(String((data as Record<string, unknown>).error));
        }
        setNotice(action === 'approve' ? 'Payment approved — booking confirmed and payer emailed.' : 'Payment rejected — payer emailed with your reason.');
        setRejectFor(null);
        setRejectReason('');
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Review failed.');
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const saveBank = useCallback(async () => {
    if (!supabase) return;
    setBusy(true);
    const { error: err } = await supabase
      .from('platform_settings')
      .upsert({ key: 'bank_details', value: bankDraft, updated_at: new Date().toISOString() });
    if (err) setError(err.message);
    else {
      setBank(bankDraft);
      setNotice('Bank details saved. Payers will see these on their bookings.');
    }
    setBusy(false);
  }, [bankDraft]);

  if (!isAdmin) {
    return (
      <div className="card-playbill mx-auto max-w-xl p-8 text-center">
        <h1 className="font-display text-xl font-bold text-ink">Approvals</h1>
        <p className="mt-2 text-sm text-ink-soft">This page is for the platform owner only.</p>
      </div>
    );
  }

  const pending = payments.filter((p) => p.status === 'pending');
  const reviewed = payments.filter((p) => p.status !== 'pending');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-ink">
          <ClipboardCheck className="h-6 w-6 text-gold-deep" aria-hidden="true" />
          Payment approvals
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Review proof-of-payment uploads. Approving confirms the booking and unlocks the video
          room; the payer is emailed either way.
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

      {/* Bank details payers see */}
      <section className="card-playbill p-5">
        <h2 className="font-display flex items-center gap-2 text-lg font-semibold text-ink">
          <Landmark className="h-5 w-5 text-gold-deep" aria-hidden="true" /> Your bank details (shown to payers)
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              ['account_name', 'Account name'],
              ['bank', 'Bank'],
              ['account_number', 'Account number'],
              ['branch_code', 'Branch code'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm text-ink">
              {label}
              <input
                className="input-stage mt-1 w-full"
                value={bankDraft[key]}
                onChange={(e) => setBankDraft((d) => ({ ...d, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveBank()}
          className="btn-gold mt-3 px-4 py-2 text-sm disabled:opacity-60"
        >
          {bank ? 'Update bank details' : 'Save bank details'}
        </button>
      </section>

      {/* Pending */}
      <section className="card-playbill p-5">
        <h2 className="font-display text-lg font-semibold text-ink">
          Awaiting review {pending.length > 0 && <span className="text-gold-deep">({pending.length})</span>}
        </h2>
        {loading ? (
          <p className="mt-2 text-sm text-ink-soft">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Nothing waiting. New proofs also arrive by email.</p>
        ) : (
          <ul className="mt-3 divide-y divide-sand">
            {pending.map((p) => (
              <li key={p.id} className="py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      {formatRand(p.amount_cents / 100)} — {p.bookings?.varsity_offerings?.title ?? 'Session'}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {p.profiles?.full_name ?? p.profiles?.email ?? 'Payer'} · Ref {p.bookings?.reference} ·{' '}
                      {new Date(p.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void viewProof(p)}
                    className="btn-ghost flex items-center gap-1 px-3 py-1.5 text-xs"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    {proofUrls[p.id] ? 'Open proof again' : 'View proof'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(p.id, 'approve')}
                    className="btn-gold flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setRejectFor(p.id)}
                    className="btn-ghost flex items-center gap-1 px-3 py-1.5 text-xs text-terracotta"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> Reject
                  </button>
                </div>
                {rejectFor === p.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-sand bg-ivory/60 p-3">
                    <input
                      className="input-stage min-w-[14rem] flex-1"
                      placeholder="Reason for rejection (required)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy || !rejectReason.trim()}
                      onClick={() => void decide(p.id, 'reject', rejectReason.trim())}
                      className="btn-ghost px-3 py-1.5 text-xs text-terracotta disabled:opacity-60"
                    >
                      Confirm rejection
                    </button>
                    <button type="button" onClick={() => setRejectFor(null)} className="btn-ghost px-3 py-1.5 text-xs">
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* History */}
      {reviewed.length > 0 && (
        <section className="card-playbill p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Reviewed</h2>
          <ul className="mt-3 divide-y divide-sand">
            {reviewed.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {formatRand(p.amount_cents / 100)} — {p.bookings?.varsity_offerings?.title ?? 'Session'}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {p.profiles?.full_name ?? p.profiles?.email} · Ref {p.bookings?.reference}
                    {p.reject_reason ? ` · Reason: ${p.reject_reason}` : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                    p.status === 'approved' ? 'bg-sage/20 text-sage' : 'bg-terracotta/15 text-terracotta',
                  )}
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
