import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/** Theatre-door login screen. */
export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-stage-bg text-cream">
      {/* Theatre backdrop with dark overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/assets/login-backdrop.png)' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(18,13,23,0.55) 0%, rgba(18,13,23,0.8) 60%, rgba(18,13,23,0.95) 100%)',
        }}
      />
      <div className="spotlight" />

      <main className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div className="card-playbill w-full max-w-md p-8">
          <h1 className="font-display text-center text-3xl font-bold text-gold-light">
            Young Agripreneurs 1 Tutor
          </h1>
          <p className="mt-2 text-center text-sm text-cream-dim">
            A stage for Kelebogile's dreams — with George &amp; Agron
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="login-email" className="font-label mb-1 block text-xs text-cream-dim">
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
                className="font-label mb-1 block text-xs text-cream-dim"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-stage"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-crimson/60 bg-crimson/15 px-3 py-2 text-sm text-crimson-light"
              >
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-gold w-full py-2.5 text-base">
              {busy ? 'Raising the curtain…' : 'Take the Stage'}
            </button>
          </form>

          <p className="mt-6 text-center font-label text-[10px] text-cream-dim/70">
            Private stage — invitation only
          </p>
        </div>
      </main>
    </div>
  );
}
