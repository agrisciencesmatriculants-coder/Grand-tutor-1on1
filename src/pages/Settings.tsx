import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, MessageSquare, Power, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useTutorStatus } from '../lib/tutorStatus';
import type { TeachingMode } from '../lib/types';

/**
 * Account settings: profile summary, teaching mode, and the danger zone.
 * Deactivation is reversible; deletion is a REAL hard delete executed
 * server-side by the delete-account edge function — the anti-Superprof rule.
 */
export default function Settings() {
  const { profile, signOut, refreshProfile } = useAuth();
  const { modes, activeMode } = useTutorStatus();
  const navigate = useNavigate();

  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState<'deactivate' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const switchMode = async (mode: TeachingMode) => {
    if (!supabase || !profile) return;
    await supabase.from('profiles').update({ active_mode: mode }).eq('id', profile.id);
    await refreshProfile();
  };

  const deactivate = async () => {
    if (!supabase) return;
    setBusy('deactivate');
    setError(null);
    try {
      const { data, error: e } = await supabase.functions.invoke('delete-account', {
        body: { mode: 'deactivate' },
      });
      if (e) throw new Error(e.message);
      if (data?.error) throw new Error(data.error);
      await refreshProfile();
      setDone('Your account is deactivated. Everything is kept — sign back in and reactivate whenever you are ready.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not deactivate.');
    } finally {
      setBusy(null);
    }
  };

  const hardDelete = async () => {
    if (!supabase || confirmText !== 'DELETE') return;
    setBusy('delete');
    setError(null);
    try {
      const { data, error: e } = await supabase.functions.invoke('delete-account', {
        body: { mode: 'delete', confirmation: 'DELETE' },
      });
      if (e) throw new Error(e.message);
      if (data?.error) throw new Error(data.error);
      // Account is gone server-side — drop the local session and leave.
      await signOut();
      navigate('/login', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deletion failed — nothing was removed. Please try again.');
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Account settings</h1>
        <p className="mt-1 text-sm text-ink-soft">Your account, your data, your choice.</p>
      </header>

      {error && (
        <div className="border border-terra/40 bg-terra/5 px-4 py-3 text-sm text-terra" role="alert">{error}</div>
      )}
      {done && (
        <div className="border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink" role="status">{done}</div>
      )}

      <section className="card-playbill p-6">
        <h2 className="font-semibold text-ink">Profile</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-3">
            <dt className="w-32 shrink-0 text-ink-soft">Name</dt>
            <dd className="text-ink">{profile?.full_name ?? '—'}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-32 shrink-0 text-ink-soft">Email</dt>
            <dd className="text-ink">{profile?.email}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-32 shrink-0 text-ink-soft">Role</dt>
            <dd className="capitalize text-ink">{profile?.role === 'teacher' ? 'Tutor' : 'Learner'}</dd>
          </div>
          {modes.length > 0 && (
            <div className="flex items-center gap-3">
              <dt className="w-32 shrink-0 text-ink-soft">Teaching mode</dt>
              <dd className="flex gap-1">
                {modes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => void switchMode(m)}
                    className={
                      m === activeMode
                        ? 'border border-gold bg-gold px-3 py-1 text-xs font-medium text-white'
                        : 'border border-sand bg-white px-3 py-1 text-xs font-medium text-ink-soft hover:border-gold/60'
                    }
                  >
                    {m === 'highschool' ? 'High School' : 'University'}
                  </button>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Danger zone */}
      <section className="border border-terra/40 bg-white p-6">
        <h2 className="flex items-center gap-2 font-semibold text-terra-deep">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" /> Danger zone
        </h2>

        <div className="mt-4 border-b border-sand pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Power className="h-4 w-4" aria-hidden="true" /> Deactivate account
              </p>
              <p className="mt-1 max-w-md text-sm text-ink-soft">
                Reversible. Your profile is hidden and teaching stops, but everything is kept exactly as it
                is. Sign back in and reactivate whenever you want.
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy !== null}
              onClick={() => void deactivate()}
            >
              {busy === 'deactivate' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Deactivate'}
            </button>
          </div>
        </div>

        <div className="mt-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete account permanently
          </p>
          <p className="mt-1 max-w-lg text-sm text-ink-soft">
            Unlike some platforms, <strong>delete means delete</strong>. Our servers remove your profile,
            messages, files, screening documents, payment proofs, quiz history, points, bookings and any
            recorded lessons — then your sign-in account itself. You receive an email receipt confirming
            the deletion. This cannot be undone.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="confirm-delete">Type DELETE to confirm</label>
            <input
              id="confirm-delete"
              className="input-stage w-44"
              placeholder="Type DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              disabled={confirmText !== 'DELETE' || busy !== null}
              onClick={() => void hardDelete()}
              className="flex items-center gap-2 border border-terra bg-terra px-4 py-2 text-sm font-semibold text-white transition hover:bg-terra-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'delete' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
              Delete my account permanently
            </button>
          </div>
        </div>
      </section>

      <ConcernForm />

      <section className="card-playbill p-6">
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
          Your data is never sold and never kept after deletion. The deletion receipt email lists exactly
          what was removed.
        </p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Raise a concern -> logged by HR (tutors) or Learner Success (learners)
// ---------------------------------------------------------------------------

function ConcernForm() {
  const { profile } = useAuth();
  const [category, setCategory] = useState<'tutoring' | 'payments' | 'technical' | 'conduct' | 'other'>('tutoring');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    if (!supabase || !profile || !subject.trim() || !body.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.from('complaints').insert({
        reporter_id: profile.id,
        category,
        audience: profile.role === 'teacher' ? 'hr' : 'learner_success',
        subject: subject.trim(),
        body: body.trim(),
      });
      if (error) throw error;
      setSubject('');
      setBody('');
      setMsg(
        profile.role === 'teacher'
          ? 'Logged with Thandi (HR Manager). The Quality Specialist will analyse it and the CEO will see it.'
          : 'Logged with Lerato (Learner Success). The Quality Specialist will analyse it and the CEO will see it.',
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not log your concern.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card-playbill p-6">
      <h2 className="flex items-center gap-2 font-semibold text-ink">
        <MessageSquare className="h-5 w-5 text-gold-deep" aria-hidden="true" /> Raise a concern
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Something not working, or someone not treating you fairly? Log it here — it goes straight to the
        management team.
      </p>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(['tutoring', 'payments', 'technical', 'conduct', 'other'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={
                category === c
                  ? 'border border-gold bg-gold px-3 py-1 text-xs font-medium capitalize text-white'
                  : 'border border-sand bg-white px-3 py-1 text-xs font-medium capitalize text-ink-soft hover:border-gold/60'
              }
            >
              {c}
            </button>
          ))}
        </div>
        <input
          className="input-stage"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          aria-label="Concern subject"
        />
        <textarea
          className="input-stage min-h-20"
          placeholder="Explain what happened…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label="Concern details"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-gold"
            disabled={busy || !subject.trim() || !body.trim()}
            onClick={() => void submit()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Log my concern'}
          </button>
          {msg && <p className="text-xs text-ink-soft">{msg}</p>}
        </div>
      </div>
    </section>
  );
}
