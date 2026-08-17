import { Drama } from 'lucide-react';
import { missingEnvVars } from '../lib/supabase';

/** Branded setup screen shown when Supabase env vars are missing (contract §6). */
export default function SetupScreen() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ivory text-ink-soft">
      {/* Backdrop image kept, softened with a light ivory veil (contract §16) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: 'url(/assets/login-backdrop.png)' }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-ivory/70" />
      <div className="spotlight" />

      <main className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div className="card-playbill w-full max-w-lg p-8">
          <p className="font-label mb-2 text-xs text-gold-deep">Configuration</p>
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold text-ink">
            <Drama className="h-7 w-7 shrink-0 text-gold" aria-hidden="true" />
            Young Agripreneurs 1 Tutor
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            The application is not configured yet — Supabase environment variables are missing.
            Set them, then refresh this page.
          </p>

          <h2 className="font-label mt-6 text-xs text-ink-soft">Missing variables</h2>
          <ul className="mt-2 space-y-2">
            {(missingEnvVars.length > 0
              ? missingEnvVars
              : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
            ).map((v) => (
              <li
                key={v}
                className="rounded-md border border-terra/50 bg-terra-tint px-3 py-2 font-mono text-sm text-terra-deep"
              >
                {v}
              </li>
            ))}
          </ul>

          <h2 className="font-label mt-6 text-xs text-ink-soft">Where to set them</h2>
          <div className="mt-2 space-y-3 text-sm text-ink-soft">
            <p>
              <span className="font-semibold text-ink">Local dev:</span> copy{' '}
              <code className="rounded bg-ivory-deep px-1.5 py-0.5 font-mono text-xs text-gold-deep">
                .env.example
              </code>{' '}
              to{' '}
              <code className="rounded bg-ivory-deep px-1.5 py-0.5 font-mono text-xs text-gold-deep">
                .env.local
              </code>{' '}
              in the project root, fill in the values, and restart{' '}
              <code className="rounded bg-ivory-deep px-1.5 py-0.5 font-mono text-xs text-gold-deep">
                npm run dev
              </code>
              .
            </p>
            <p>
              <span className="font-semibold text-ink">Vercel:</span> Project → Settings →
              Environment Variables → add{' '}
              <code className="rounded bg-ivory-deep px-1.5 py-0.5 font-mono text-xs text-gold-deep">
                VITE_SUPABASE_URL
              </code>{' '}
              and{' '}
              <code className="rounded bg-ivory-deep px-1.5 py-0.5 font-mono text-xs text-gold-deep">
                VITE_SUPABASE_ANON_KEY
              </code>
              , then redeploy. Find both in your Supabase dashboard → Project Settings → API.
            </p>
            <p className="text-xs">
              Optional:{' '}
              <code className="rounded bg-ivory-deep px-1.5 py-0.5 font-mono text-xs text-gold-deep">
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
