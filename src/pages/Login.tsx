import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Presentation } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Role } from '../lib/types';
import { cn } from '../lib/utils';

/** Sign-in / create-account screen (Phase 3: public sign-up with roles). */
export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        navigate('/', { replace: true });
      } else {
        const { data: flag } = await supabase!
          .from('platform_settings')
          .select('value')
          .eq('key', 'signups_disabled')
          .maybeSingle();
        if (flag?.value === true) {
          throw new Error('New registrations are temporarily paused. Please try again later.');
        }
        await signUp(email, password, fullName, role, whatsapp);
        setNotice(
          'Account created. Check your inbox to confirm your email, then sign in — your welcome code will be waiting in the waiting room.',
        );
        setMode('signin');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-ivory text-ink-soft">
      {/* Official top strip */}
      <div className="bg-[#007749] py-1 text-center text-[11px] font-medium tracking-wide text-white">
        VukaTV — South African low-data learning platform
      </div>

      <main className="relative z-10 flex min-h-[calc(100vh-2rem)] items-center justify-center p-6">
        <div className="card-playbill w-full max-w-md p-8">
          <h1 className="text-center text-3xl font-bold text-ink">
            VukaTV
          </h1>
          <p className="mt-2 text-center text-sm text-ink-soft">
            Low-data lessons that air like TV. Learners watch for kilobytes; tutors earn Vuka
            Points when learners improve.
          </p>

          {/* Mode toggle */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-md border border-sand bg-ivory/70 p-1" role="tablist">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setNotice(null);
                }}
                className={cn(
                  'rounded px-3 py-1.5 text-sm font-medium transition',
                  mode === m ? 'bg-gold/15 text-gold-deep shadow-sm' : 'text-ink-soft hover:text-ink',
                )}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="signup-name" className="font-label mb-1 block text-xs text-ink-soft">
                    Full name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-stage"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="signup-whatsapp" className="font-label mb-1 block text-xs text-ink-soft">
                    WhatsApp number <span className="font-normal">(optional — backup for your welcome code)</span>
                  </label>
                  <input
                    id="signup-whatsapp"
                    type="tel"
                    autoComplete="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="input-stage"
                    placeholder="e.g. +27 82 123 4567"
                  />
                </div>
                <fieldset>
                  <legend className="font-label mb-1 text-xs text-ink-soft">I am joining as a</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition',
                        role === 'student'
                          ? 'border-gold bg-gold/15 text-gold-deep'
                          : 'border-sand bg-paper text-ink-soft hover:bg-gold/5',
                      )}
                    >
                      <GraduationCap className="h-4 w-4" aria-hidden="true" /> Learner
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('teacher')}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition',
                        role === 'teacher'
                          ? 'border-gold bg-gold/15 text-gold-deep'
                          : 'border-sand bg-paper text-ink-soft hover:bg-gold/5',
                      )}
                    >
                      <Presentation className="h-4 w-4" aria-hidden="true" /> Tutor
                    </button>
                  </div>
                  {role === 'teacher' && (
                    <p className="mt-1.5 text-xs text-ink-soft">
                      Tutors record lessons in the Studio and earn Vuka Points from learner quiz
                      improvement. New tutors complete a short screening application (motivation,
                      subjects, intro video, documents and a subject test) before teaching.
                    </p>
                  )}
                </fieldset>
              </>
            )}

            <div>
              <label htmlFor="login-email" className="font-label mb-1 block text-xs text-ink-soft">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-stage"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="font-label mb-1 block text-xs text-ink-soft"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'signup' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-stage"
                placeholder="••••••••"
              />
              {mode === 'signup' && (
                <p className="mt-1 text-xs text-ink-soft">At least 8 characters.</p>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-terra/50 bg-terra-tint px-3 py-2 text-sm text-terra-deep"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="rounded-md border border-sage/50 bg-sage/10 px-3 py-2 text-sm text-ink"
              >
                {notice}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-gold w-full py-2.5 text-base">
              {busy
                ? mode === 'signin'
                  ? 'Signing in…'
                  : 'Creating account…'
                : mode === 'signin'
                  ? 'Sign in'
                  : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center font-label text-[10px] text-ink-soft/70">
            VukaTV — low-data learning, on air
          </p>
        </div>
      </main>
    </div>
  );
}
