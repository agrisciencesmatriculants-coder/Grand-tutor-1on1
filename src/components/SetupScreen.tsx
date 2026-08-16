import { Drama } from 'lucide-react';
import { missingEnvVars } from '../lib/supabase';

/** Branded setup screen shown when Supabase env vars are missing (contract §6). */
export default function SetupScreen() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-stage-bg text-cream">
      {/* Dimmed theatre backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: 'url(/assets/login-backdrop.png)' }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-stage-bg/70" />
      <div className="spotlight" />

      <main className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div className="card-playbill w-full max-w-lg p-8">
          <p className="font-label mb-2 text-xs text-gold">Backstage · Configuration</p>
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-gold-light">
            <Drama className="h-7 w-7 shrink-0 text-gold" aria-hidden="true" />
            Young Agripreneurs 1 Tutor
          </h1>
          <p className="mt-3 text-sm text-cream-dim">
            The stage isn't lit yet — Supabase environment variables are missing. Set them, then
            refresh this page.
          </p>

          <h2 className="font-label mt-6 text-xs text-cream-dim">Missing variables</h2>
          <ul className="mt-2 space-y-2">
            {(missingEnvVars.length > 0
              ? missingEnvVars
              : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
            ).map((v) => (
              <li
                key={v}
                className="rounded-md border border-crimson/50 bg-crimson/10 px-3 py-2 font-mono text-sm text-crimson-light"
              >
                {v}
              </li>
            ))}
          </ul>

          <h2 className="font-label mt-6 text-xs text-cream-dim">Where to set them</h2>
          <div className="mt-2 space-y-3 text-sm text-cream-dim">
            <p>
              <span className="font-semibold text-cream">Local dev:</span> copy{' '}
              <code className="rounded bg-stage-deep px-1.5 py-0.5 font-mono text-xs text-gold-light">
                .env.example
              </code>{' '}
              to{' '}
              <code className="rounded bg-stage-deep px-1.5 py-0.5 font-mono text-xs text-gold-light">
                .env.local
              </code>{' '}
              in the project root, fill in the values, and restart{' '}
              <code className="rounded bg-stage-deep px-1.5 py-0.5 font-mono text-xs text-gold-light">
                npm run dev
              </code>
              .
            </p>
            <p>
              <span className="font-semibold text-cream">Vercel:</span> Project → Settings →
              Environment Variables → add{' '}
              <code className="rounded bg-stage-deep px-1.5 py-0.5 font-mono text-xs text-gold-light">
                VITE_SUPABASE_URL
              </code>{' '}
              and{' '}
              <code className="rounded bg-stage-deep px-1.5 py-0.5 font-mono text-xs text-gold-light">
                VITE_SUPABASE_ANON_KEY
              </code>
              , then redeploy. Find both in your Supabase dashboard → Project Settings → API.
            </p>
            <p className="text-xs">
              Optional:{' '}
              <code className="rounded bg-stage-deep px-1.5 py-0.5 font-mono text-xs text-gold-light">
                VITE_GCAL_ID
              </code>{' '}
              enables the Google Calendar embed on the Sessions page.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
