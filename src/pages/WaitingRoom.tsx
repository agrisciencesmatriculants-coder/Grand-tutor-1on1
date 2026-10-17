import { useState } from 'react';
import { Clock, KeyRound, Loader2, Mail, MessageCircle, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

/**
 * The Waiting Room (Phase 8): new members see ONLY this until they verify
 * with the welcome code from their email. Tutors: strictly required.
 * Learners: after 3 failed attempts they may continue with a permanent
 * "email not verified" note, or request the code via WhatsApp.
 */
export default function WaitingRoom() {
  const { profile, refreshProfile } = useAuth();
  const isTutor = profile?.role === 'teacher';

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'send' | 'verify' | 'skip' | 'whatsapp' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(profile?.code_attempts ?? 0);
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp_number ?? '');
  const [whatsappRequested, setWhatsappRequested] = useState(profile?.whatsapp_code_requested ?? false);

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error: e } = await supabase!.functions.invoke('welcome-code', { body });
    if (e) throw new Error(e.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const send = async () => {
    setBusy('send');
    setError(null);
    try {
      await invoke({ action: 'send' });
      setNotice('Welcome email sent — check your inbox (and spam folder) for your code.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the email.');
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    setBusy('verify');
    setError(null);
    try {
      const data = await invoke({ action: 'verify', code });
      if (data.verified) {
        await refreshProfile();
        return;
      }
      setAttempts(data.attempts);
      setError(
        data.remaining > 0
          ? `That code is not correct. ${data.remaining} attempt${data.remaining === 1 ? '' : 's'} remaining.`
          : 'That code is not correct.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setBusy(null);
    }
  };

  const skip = async () => {
    setBusy('skip');
    setError(null);
    try {
      await invoke({ action: 'skip' });
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not continue.');
      setBusy(null);
    }
  };

  const requestWhatsapp = async () => {
    setBusy('whatsapp');
    setError(null);
    try {
      await invoke({ action: 'whatsapp', whatsapp_number: whatsapp });
      setWhatsappRequested(true);
      setNotice('Noted — the VukaTV team will send your code to your WhatsApp number.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record your number.');
    } finally {
      setBusy(null);
    }
  };

  const failed3 = attempts >= 3;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="card-playbill p-8">
        <div className="text-center">
          <Clock className="mx-auto h-10 w-10 text-gold" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-bold text-ink">Welcome to the waiting room</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {isTutor
              ? 'Every VukaTV tutor is verified before teaching. We emailed you a welcome code — enter it below to continue to your tutor screening.'
              : 'We emailed you a welcome code. Enter it below to verify your email address and enter the platform.'}
          </p>
        </div>

        {error && (
          <div className="mt-4 border border-terra/40 bg-terra/5 px-4 py-3 text-sm text-terra" role="alert">{error}</div>
        )}
        {notice && (
          <div className="mt-4 border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink" role="status">{notice}</div>
        )}

        <div className="mt-6">
          <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="code">
            <KeyRound className="mr-1 inline h-4 w-4" aria-hidden="true" /> Welcome code
          </label>
          <div className="flex gap-2">
            <input
              id="code"
              className="input-stage flex-1 font-mono text-lg uppercase tracking-[0.3em]"
              placeholder="ABCD12"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoComplete="off"
            />
            <button
              type="button"
              className="btn-gold flex items-center gap-2"
              disabled={busy !== null || code.trim().length < 6}
              onClick={() => void verify()}
            >
              {busy === 'verify' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Verify
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-soft">4 letters + 2 numbers, from your welcome email.</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sand pt-4">
          <button
            type="button"
            className="btn-ghost flex items-center gap-2 text-xs"
            disabled={busy !== null}
            onClick={() => void send()}
          >
            {busy === 'send' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Mail className="h-3.5 w-3.5" aria-hidden="true" />}
            {profile?.welcome_code ? 'Resend welcome email' : 'Send my welcome email'}
          </button>
          {attempts > 0 && attempts < 3 && (
            <span className="text-xs text-ink-soft">{attempts} of 3 attempts used</span>
          )}
        </div>

        {/* AI-assisted help after failures */}
        {failed3 && (
          <div className="mt-4 space-y-4 border-t border-sand pt-4">
            <div className="flex items-start gap-2 text-sm text-ink-soft">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
              <div>
                <p className="font-semibold text-ink">Having trouble? A few things that usually fix it:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>Check the spam or promotions folder for an email from VukaTV.</li>
                  <li>The code has no letter O and no digit 0 — and no I or 1.</li>
                  <li>Codes are case-insensitive; spaces do not matter.</li>
                  <li>Tap “Resend welcome email” for a fresh code.</li>
                </ul>
              </div>
            </div>

            {/* WhatsApp fallback */}
            {!whatsappRequested ? (
              <div className="border border-sand p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" /> Get the code on WhatsApp instead
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    className="input-stage flex-1"
                    placeholder="e.g. +27 82 123 4567"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    aria-label="WhatsApp number"
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy !== null || whatsapp.trim().length < 8}
                    onClick={() => void requestWhatsapp()}
                  >
                    {busy === 'whatsapp' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Request'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-ink-soft">A member of the team sends it manually — usually within a day.</p>
              </div>
            ) : (
              <p className="border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-ink">
                <MessageCircle className="mr-1 inline h-4 w-4" aria-hidden="true" />
                WhatsApp request recorded for {profile?.whatsapp_number ?? whatsapp}. Keep this page open or come back later.
              </p>
            )}

            {/* Learner escape hatch — never for tutors */}
            {!isTutor && (
              <button
                type="button"
                className="btn-ghost flex items-center gap-2 text-xs"
                disabled={busy !== null}
                onClick={() => void skip()}
              >
                {busy === 'skip' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                Continue without verifying (a note is added to your account)
              </button>
            )}
          </div>
        )}
      </div>

      {isTutor && (
        <div className="card-playbill p-5">
          <p className="flex items-start gap-2 text-sm text-ink-soft">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
            After verification you will complete the tutor screening: motivation, subjects, availability,
            intro video, documents and a prove-your-subject test. Your place in the queue is kept.
          </p>
        </div>
      )}
    </div>
  );
}
