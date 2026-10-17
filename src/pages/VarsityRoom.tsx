import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Lock, Video } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Booking } from '../lib/types';

/**
 * Jitsi room for a confirmed booking. The room unlocks only when the booking
 * is confirmed (payment approved) and the signed-in user is the learner, the
 * tutor, or the admin. Jitsi is embedded via its public iframe — no API keys.
 */
export default function VarsityRoom() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { profile } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !bookingId) return;
    let cancelled = false;
    supabase
      .from('bookings')
      .select('*, varsity_offerings(*)')
      .eq('id', bookingId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err || !data) setError('Booking not found.');
        else setBooking(data as Booking);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (loading) {
    return <p className="py-16 text-center text-sm text-ink-soft">Loading the room…</p>;
  }

  if (error || !booking) {
    return (
      <div className="card-playbill mx-auto max-w-xl p-8 text-center">
        <p className="font-display text-lg font-semibold text-ink">Room unavailable</p>
        <p className="mt-1 text-sm text-ink-soft">{error ?? 'Booking not found.'}</p>
        <Link to="/varsity" className="btn-ghost mt-4 inline-flex items-center gap-1 px-3 py-1.5 text-sm">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Varsity
        </Link>
      </div>
    );
  }

  const offering = booking.varsity_offerings;
  const isParticipant =
    profile && (booking.learner_id === profile.id || offering?.tutor_id === profile.id || profile.email === 'youngagripreneurs.ng@gmail.com');

  if (!isParticipant) {
    return (
      <div className="card-playbill mx-auto max-w-xl p-8 text-center">
        <Lock className="mx-auto h-8 w-8 text-ink-soft" aria-hidden="true" />
        <p className="font-display mt-2 text-lg font-semibold text-ink">Participants only</p>
        <p className="mt-1 text-sm text-ink-soft">This room is limited to the booked learner and tutor.</p>
      </div>
    );
  }

  if (booking.status !== 'confirmed') {
    return (
      <div className="card-playbill mx-auto max-w-xl p-8 text-center">
        <Clock className="mx-auto h-8 w-8 text-gold-deep" aria-hidden="true" />
        <p className="font-display mt-2 text-lg font-semibold text-ink">The room is still locked</p>
        <p className="mt-1 text-sm text-ink-soft">
          {booking.status === 'pending_review'
            ? 'Your proof of payment is being reviewed. The room unlocks once the payment is approved.'
            : booking.status === 'pending_payment'
              ? 'Complete the EFT payment and upload your proof on the Varsity page to unlock this room.'
              : 'This booking is no longer active.'}
        </p>
        <Link to="/varsity" className="btn-ghost mt-4 inline-flex items-center gap-1 px-3 py-1.5 text-sm">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Varsity
        </Link>
      </div>
    );
  }

  const roomName = booking.jitsi_room.replace(/[^a-zA-Z0-9-]/g, '');
  const displayName = encodeURIComponent(profile?.full_name ?? 'VukaTV member');
  const src = `https://meet.jit.si/${roomName}#userInfo.displayName="${displayName}"`;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <Link to="/varsity" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Varsity
        </Link>
        <h1 className="font-display flex items-center gap-2 text-xl font-bold text-ink">
          <Video className="h-5 w-5 text-gold-deep" aria-hidden="true" />
          {offering?.title ?? 'Session room'}
        </h1>
        <span className="text-xs text-ink-soft">
          {new Date(booking.scheduled_at).toLocaleString()} · Ref {booking.reference}
        </span>
      </header>
      <div className="overflow-hidden rounded-lg border border-sand bg-ink shadow-sm" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          src={src}
          title="Video session room"
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="h-full w-full border-0"
        />
      </div>
      <p className="text-xs text-ink-soft">
        The video room is provided by Jitsi Meet. Allow camera and microphone access when prompted.
      </p>
    </div>
  );
}
