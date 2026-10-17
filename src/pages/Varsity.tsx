import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  CalendarClock,
  Check,
  Clock,
  Copy,
  Landmark,
  Plus,
  ShieldCheck,
  Star,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTutorStatus } from '../lib/tutorStatus';
import { supabase } from '../lib/supabase';
import type { BankDetails, Booking, Payment, VarsityOffering } from '../lib/types';
import { FACULTIES, courseLabel } from '../lib/universities';
import { formatRand } from '../lib/vp';
import { cn } from '../lib/utils';

const BOOKING_STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-sand/60 text-ink-soft',
  pending_review: 'bg-gold/15 text-gold-deep',
  confirmed: 'bg-sage/20 text-sage',
  rejected: 'bg-terracotta/15 text-terracotta',
  cancelled: 'bg-sand/60 text-ink-soft',
};

function makeReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = '';
  const arr = new Uint32Array(6);
  crypto.getRandomValues(arr);
  for (const n of arr) ref += chars[n % chars.length];
  return `VUKA-${ref}`;
}

export default function Varsity() {
  const { profile, role } = useAuth();
  const { approved: approvedTutor, modes } = useTutorStatus();
  const isTutor = role === 'teacher';
  // Phase 6: paid Varsity sessions require an approved application with
  // the University (varsity) mode.
  const canOffer = isTutor && approvedTutor && modes.includes('varsity');

  const [offerings, setOfferings] = useState<VarsityOffering[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [tutorBookings, setTutorBookings] = useState<Booking[]>([]);
  const [myReviewedBookings, setMyReviewedBookings] = useState<Set<string>>(new Set());
  const [myPayments, setMyPayments] = useState<Payment[]>([]);
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [bookingFor, setBookingFor] = useState<VarsityOffering | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !profile) return;
    setLoading(true);
    const [{ data: offs }, { data: mine }, { data: pays }, { data: settings }] = await Promise.all([
      supabase
        .from('varsity_offerings')
        .select('*, profiles:tutor_id(full_name)')
        .eq('active', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('bookings')
        .select('*, varsity_offerings(*)')
        .eq('learner_id', profile.id)
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('payments')
        .select('*')
        .eq('payer_id', profile.id)
        .order('created_at', { ascending: false }),
      supabase.from('platform_settings').select('value').eq('key', 'bank_details').maybeSingle(),
    ]);
    setOfferings((offs ?? []) as VarsityOffering[]);
    setMyBookings((mine ?? []) as Booking[]);
    setMyPayments((pays ?? []) as Payment[]);
    if (settings?.value) setBank(settings.value as BankDetails);

    const { data: myReviews } = await supabase
      .from('reviews')
      .select('booking_id')
      .eq('learner_id', profile.id);
    setMyReviewedBookings(new Set(((myReviews ?? []) as { booking_id: string }[]).map((r) => r.booking_id)));

    if (isTutor) {
      const { data: tb } = await supabase
        .from('bookings')
        .select('*, varsity_offerings!inner(*)')
        .eq('varsity_offerings.tutor_id', profile.id)
        .order('scheduled_at', { ascending: true });
      setTutorBookings((tb ?? []) as Booking[]);
    }
    setLoading(false);
  }, [isTutor, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancelBooking = useCallback(
    async (id: string) => {
      if (!supabase) return;
      const { error: err } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
      if (err) setError(err.message);
      else await load();
    },
    [load],
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-ink">
            <Video className="h-6 w-6 text-gold-deep" aria-hidden="true" />
            Varsity
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Paid one-on-one sessions over video. Pay by EFT, upload your proof, and the session
            unlocks once the payment is approved.
          </p>
        </div>
        {canOffer ? (
          <button type="button" onClick={() => setShowCreate(true)} className="btn-gold flex items-center gap-2 px-4 py-2 text-sm">
            <Plus className="h-4 w-4" aria-hidden="true" /> Offer a session
          </button>
        ) : isTutor ? (
          <Link to="/apply" className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {approvedTutor ? 'Add University mode to your application' : 'Get screened to offer sessions'}
          </Link>
        ) : null}
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

      {/* Offerings */}
      <section>
        <h2 className="font-display mb-3 text-lg font-semibold text-ink">Available sessions</h2>
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : offerings.length === 0 ? (
          <div className="card-playbill p-8 text-center">
            <p className="font-display text-lg font-semibold text-ink">No sessions offered yet</p>
            <p className="mt-1 text-sm text-ink-soft">
              {isTutor ? 'Offer your first paid session with the button above.' : 'Check back soon.'}
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offerings.map((o) => (
              <li key={o.id} className="card-playbill flex flex-col p-4">
                <p className="font-display truncate text-base font-semibold text-ink">{o.title}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {o.profiles?.full_name ?? 'Tutor'}
                  {o.subject ? ` · ${o.subject}` : ''}
                </p>
                {o.description && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{o.description}</p>}
                <p className="mt-2 flex items-center gap-3 text-xs text-ink-soft">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden="true" /> {o.duration_min} min
                  </span>
                  <span className="font-semibold text-gold-deep">{formatRand(o.price_cents / 100)}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setBookingFor(o)}
                  className="btn-gold mt-3 px-3 py-1.5 text-xs"
                >
                  Book this session
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* My bookings (learner) */}
      {myBookings.length > 0 && (
        <section className="card-playbill p-5">
          <h2 className="font-display text-lg font-semibold text-ink">My bookings</h2>
          <ul className="mt-3 divide-y divide-sand">
            {myBookings.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                bank={bank}
                payment={myPayments.find((p) => p.booking_id === b.id) ?? null}
                onCancel={cancelBooking}
                onSubmitted={async (msg) => {
                  setNotice(msg);
                  await load();
                }}
                reviewed={myReviewedBookings.has(b.id)}
                onReviewed={load}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Bookings on my offerings (tutor) */}
      {isTutor && tutorBookings.length > 0 && (
        <section className="card-playbill p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Bookings on my sessions</h2>
          <ul className="mt-3 divide-y divide-sand">
            {tutorBookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{b.varsity_offerings?.title ?? 'Session'}</p>
                  <p className="flex items-center gap-2 text-xs text-ink-soft">
                    <CalendarClock className="h-3 w-3" aria-hidden="true" />
                    {new Date(b.scheduled_at).toLocaleString()} · Ref {b.reference}
                  </p>
                  {b.learner_needs && (
                    <p className="mt-1 border-l-2 border-gold/50 pl-2 text-xs text-ink-soft">
                      <span className="font-semibold text-ink">Learner needs:</span> {b.learner_needs}
                    </p>
                  )}
                </div>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', BOOKING_STATUS_STYLES[b.status])}>
                  {b.status.replace('_', ' ')}
                </span>
                {b.status === 'confirmed' && (
                  <Link to={`/varsity/room/${b.id}`} className="btn-gold flex items-center gap-1 px-3 py-1.5 text-xs">
                    <Video className="h-3.5 w-3.5" aria-hidden="true" /> Join room
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {bookingFor && bank !== undefined && (
        <BookingModal
          offering={bookingFor}
          learnerId={profile?.id ?? ''}
          onClose={() => setBookingFor(null)}
          onBooked={async () => {
            setBookingFor(null);
            setNotice('Booking created. Make the EFT and upload your proof of payment below.');
            await load();
          }}
        />
      )}
      {showCreate && (
        <CreateOfferingModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

/** One learner booking row: status, payment instructions, proof upload. */
function BookingRow({
  booking: b,
  bank,
  payment,
  onCancel,
  onSubmitted,
  reviewed,
  onReviewed,
}: {
  booking: Booking;
  bank: BankDetails | null;
  payment: Payment | null;
  onCancel: (id: string) => Promise<void>;
  onSubmitted: (msg: string) => Promise<void>;
  reviewed: boolean;
  onReviewed: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const offering = b.varsity_offerings;
  const amount = offering ? offering.price_cents / 100 : 0;

  const uploadProof = useCallback(
    async (file: File) => {
      if (!supabase) return;
      setErr(null);
      if (file.size > 10 * 1024 * 1024) {
        setErr('Proof file must be under 10 MB.');
        return;
      }
      setBusy(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error('Not signed in.');
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${uid}/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, file);
        if (upErr) throw upErr;

        const { data: paymentRow, error: insErr } = await supabase
          .from('payments')
          .insert({
            payer_id: uid,
            booking_id: b.id,
            amount_cents: Math.round(amount * 100),
            proof_path: path,
          })
          .select('id')
          .single();
        if (insErr) throw insErr;

        // Notify the owner by email (best-effort).
        await supabase.functions.invoke('submit-payment', {
          body: { payment_id: paymentRow.id },
        });
        await onSubmitted('Proof of payment submitted. The owner will review it shortly.');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Upload failed. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [amount, b.id, onSubmitted],
  );

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{offering?.title ?? 'Session'}</p>
          <p className="flex items-center gap-2 text-xs text-ink-soft">
            <CalendarClock className="h-3 w-3" aria-hidden="true" />
            {new Date(b.scheduled_at).toLocaleString()} · {formatRand(amount)} · Ref {b.reference}
          </p>
        </div>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', BOOKING_STATUS_STYLES[b.status])}>
          {b.status.replace('_', ' ')}
        </span>
        {b.status === 'confirmed' && (
          <Link to={`/varsity/room/${b.id}`} className="btn-gold flex items-center gap-1 px-3 py-1.5 text-xs">
            <Video className="h-3.5 w-3.5" aria-hidden="true" /> Join room
          </Link>
        )}
        {(b.status === 'pending_payment' || b.status === 'pending_review') && (
          <button
            type="button"
            onClick={() => void onCancel(b.id)}
            className="btn-ghost flex items-center gap-1 px-2.5 py-1 text-xs text-terracotta"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
          </button>
        )}
      </div>

      {/* Rate a completed session (one review per booking) */}
      {b.status === 'confirmed' && new Date(b.scheduled_at).getTime() < Date.now() && !reviewed && (
        <RateSession booking={b} onDone={onReviewed} />
      )}

      {b.status === 'pending_payment' && (
        <div className="mt-3 rounded-md border border-sand bg-ivory/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Landmark className="h-4 w-4 text-gold-deep" aria-hidden="true" /> Pay by EFT
          </h3>
          {bank ? (
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-soft">Account name</dt><dd className="text-ink">{bank.account_name}</dd></div>
              <div><dt className="text-xs text-ink-soft">Bank</dt><dd className="text-ink">{bank.bank}</dd></div>
              <div><dt className="text-xs text-ink-soft">Account number</dt><dd className="font-mono text-ink">{bank.account_number}</dd></div>
              <div><dt className="text-xs text-ink-soft">Branch code</dt><dd className="font-mono text-ink">{bank.branch_code}</dd></div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Bank details are being set up — please check back shortly.</p>
          )}
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-xs text-ink-soft">Reference (use exactly):</span>
            <code className="rounded bg-sand/50 px-1.5 py-0.5 font-mono text-xs text-ink">{b.reference}</code>
            <button
              type="button"
              aria-label="Copy reference"
              onClick={() => {
                void navigator.clipboard?.writeText(b.reference);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
              className="text-ink-soft hover:text-ink"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-sage" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          </div>

          <div className="mt-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadProof(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={busy || !bank}
              onClick={() => fileRef.current?.click()}
              className="btn-gold flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {busy ? 'Uploading…' : 'Upload proof of payment'}
            </button>
            {err && <p className="mt-2 text-sm text-terracotta" role="alert">{err}</p>}
          </div>
        </div>
      )}

      {b.status === 'pending_review' && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gold-deep">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Proof submitted — awaiting the owner’s review.
        </p>
      )}
      {b.status === 'rejected' && payment?.reject_reason && (
        <p className="mt-2 text-xs text-terracotta">
          Payment not approved: {payment.reject_reason}
        </p>
      )}
    </li>
  );
}

/** Create a booking (learner): pick a time, get the EFT reference. */
function BookingModal({
  offering,
  learnerId,
  onClose,
  onBooked,
}: {
  offering: VarsityOffering;
  learnerId: string;
  onClose: () => void;
  onBooked: () => Promise<void>;
}) {
  const [when, setWhen] = useState('');
  const [needs, setNeeds] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const book = useCallback(async () => {
    if (!supabase || !when) return;
    setBusy(true);
    setErr(null);
    try {
      const { error: bErr } = await supabase.from('bookings').insert({
        offering_id: offering.id,
        learner_id: learnerId,
        scheduled_at: new Date(when).toISOString(),
        reference: makeReference(),
        jitsi_room: `vukatv-${crypto.randomUUID()}`,
        learner_needs: needs.trim() || null,
      });
      if (bErr) throw bErr;
      await onBooked();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the booking.');
    } finally {
      setBusy(false);
    }
  }, [learnerId, needs, offering.id, onBooked, when]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true">
      <div className="card-playbill w-full max-w-md p-6">
        <div className="flex items-start justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Book this session</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-soft hover:text-ink">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {offering.title} — {formatRand(offering.price_cents / 100)} · {offering.duration_min} min
        </p>
        <label className="mt-4 block text-sm font-medium text-ink">
          Date and time
          <input
            type="datetime-local"
            className="input-stage mt-1 w-full"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-ink">
          What do you need help with?
          <textarea
            className="input-stage mt-1 min-h-20 w-full"
            value={needs}
            onChange={(e) => setNeeds(e.target.value)}
            placeholder="Topics you are stuck on, and the areas you need your tutor to be strong in — e.g. 'consolidations and cash-flow statements, exam technique'."
          />
          <span className="mt-1 block text-xs text-ink-soft">
            Your tutor sees this before the session so they can prepare.
          </span>
        </label>
        {err && <p className="mt-2 text-sm text-terracotta" role="alert">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!when || busy}
            onClick={() => void book()}
            className="btn-gold flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
          >
            <Banknote className="h-4 w-4" aria-hidden="true" />
            {busy ? 'Booking…' : 'Create booking'}
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          After booking you will see the bank details and your unique EFT reference, then upload
          your proof of payment.
        </p>
      </div>
    </div>
  );
}

/** Tutor: create a paid session offering. */
function CreateOfferingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [faculty, setFaculty] = useState(FACULTIES[0].name);
  const [degreeName, setDegreeName] = useState(FACULTIES[0].degrees[0].name);
  const [year, setYear] = useState(1);
  const [description, setDescription] = useState('');
  const [priceRand, setPriceRand] = useState('150');
  const [duration, setDuration] = useState('60');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const degree = FACULTIES.find((f) => f.name === faculty)?.degrees.find((d) => d.name === degreeName);
  const yearCourses = (degree?.courses ?? []).filter((c) => c.year === year);

  const create = useCallback(async () => {
    if (!supabase || !profile) return;
    const cents = Math.round(parseFloat(priceRand) * 100);
    if (!title.trim() || !Number.isFinite(cents) || cents <= 0) {
      setErr('Enter a title and a valid price.');
      return;
    }
    setBusy(true);
    setErr(null);
    const { error: insErr } = await supabase.from('varsity_offerings').insert({
      tutor_id: profile.id,
      title: title.trim(),
      subject: subject.trim() || null,
      description: description.trim() || null,
      price_cents: cents,
      duration_min: Math.max(15, Math.min(480, parseInt(duration, 10) || 60)),
    });
    if (insErr) setErr(insErr.message);
    else await onCreated();
    setBusy(false);
  }, [description, duration, onCreated, priceRand, profile, subject, title]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true">
      <div className="card-playbill w-full max-w-md p-6">
        <div className="flex items-start justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Offer a session</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-soft hover:text-ink">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <input className="input-stage w-full" placeholder="Title (e.g. Grade 12 Maths exam prep)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs font-medium text-ink-soft">
                Faculty
                <select
                  className="input-stage mt-1 w-full"
                  value={faculty}
                  onChange={(e) => {
                    const f = FACULTIES.find((x) => x.name === e.target.value)!;
                    setFaculty(f.name);
                    setDegreeName(f.degrees[0].name);
                    setYear(1);
                  }}
                >
                  {FACULTIES.map((f) => (
                    <option key={f.name} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-ink-soft">
                Degree
                <select
                  className="input-stage mt-1 w-full"
                  value={degreeName}
                  onChange={(e) => { setDegreeName(e.target.value); setYear(1); }}
                >
                  {(FACULTIES.find((f) => f.name === faculty)?.degrees ?? []).map((d) => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-ink-soft">
                Year
                <select className="input-stage mt-1 w-full" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {Array.from({ length: degree?.years ?? 3 }, (_, i) => i + 1).map((y) => (
                    <option key={y} value={y}>Year {y}</option>
                  ))}
                </select>
              </label>
            </div>
            <select
              className="input-stage w-full"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-label="Course"
            >
              <option value="">Choose the course…</option>
              {yearCourses.map((c) => (
                <option key={c.code} value={courseLabel(c)}>{courseLabel(c)}</option>
              ))}
            </select>
            <input
              className="input-stage w-full"
              placeholder="Not listed? Type the course as your university calls it"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <textarea className="input-stage w-full" rows={3} placeholder="What will learners get?" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-ink">
              Price (ZAR)
              <input type="number" min="1" step="1" className="input-stage mt-1 w-full" value={priceRand} onChange={(e) => setPriceRand(e.target.value)} />
            </label>
            <label className="text-sm text-ink">
              Duration (min)
              <input type="number" min="15" max="480" step="15" className="input-stage mt-1 w-full" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </label>
          </div>
          {err && <p className="text-sm text-terracotta" role="alert">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={() => void create()} className="btn-gold px-4 py-2 text-sm disabled:opacity-60">
              {busy ? 'Creating…' : 'Create offering'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Learner: rate a completed session (1–5 stars + optional comment). */
function RateSession({ booking, onDone }: { booking: Booking; onDone: () => Promise<void> }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!supabase || rating === 0) return;
    setBusy(true);
    setErr(null);
    const tutorId = booking.varsity_offerings?.tutor_id;
    if (!tutorId) {
      setErr('Could not identify the tutor for this session.');
      setBusy(false);
      return;
    }
    const { error } = await supabase.from('reviews').insert({
      booking_id: booking.id,
      tutor_id: tutorId,
      learner_id: booking.learner_id,
      rating,
      comment: comment.trim() || null,
    });
    if (error) setErr(error.message);
    else await onDone();
    setBusy(false);
  };

  return (
    <div className="mt-3 border border-gold/30 bg-gold/5 p-3">
      <p className="text-xs font-semibold text-ink">How was this session? Your review helps other learners.</p>
      <div className="mt-1.5 flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={`${i} star${i === 1 ? '' : 's'}`}
            onClick={() => setRating(i)}
          >
            <Star
              className={cn('h-5 w-5', i <= rating ? 'fill-gold text-gold' : 'text-sand hover:text-gold/60')}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <textarea
        className="input-stage mt-2 min-h-12 w-full text-sm"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="A sentence helps — what went well, what could improve…"
        aria-label="Review comment"
      />
      {err && <p className="mt-1 text-xs text-terracotta" role="alert">{err}</p>}
      <button
        type="button"
        disabled={rating === 0 || busy}
        onClick={() => void submit()}
        className="btn-gold mt-2 px-3 py-1 text-xs disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Submit review'}
      </button>
    </div>
  );
}
