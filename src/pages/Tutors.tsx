import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, MapPin, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';

type PublicTutor = {
  id: string;
  full_name: string | null;
  tutor_modes: string[] | null;
  subjects: { highschool?: string[]; varsity?: string[] } | null;
  province: string | null;
  rating_avg: number;
  rating_count: number;
};

type PublicReview = {
  tutor_id: string;
  rating: number;
  comment: string;
  created_at: string;
};

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= Math.round(value) ? 'fill-gold text-gold' : 'text-sand'}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

/**
 * Public tutor directory — the crawlable marketplace page. Only approved
 * tutors appear, with safe public columns served by the public_tutors view.
 */
export default function Tutors() {
  const [tutors, setTutors] = useState<PublicTutor[]>([]);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const [{ data: t }, { data: r }] = await Promise.all([
        supabase.from('public_tutors').select('*').order('rating_avg', { ascending: false }),
        supabase.from('public_reviews').select('*').order('created_at', { ascending: false }),
      ]);
      setTutors((t as PublicTutor[]) ?? []);
      setReviews((r as PublicReview[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-ivory font-sans text-ink">
      <header className="border-b border-sand bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/about" className="text-lg font-bold">
            <span className="text-gold-deep">Vuka</span>TV
          </Link>
          <Link to="/login" className="btn-gold px-4 py-2 text-sm">Sign in / Join</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GraduationCap className="h-6 w-6 text-gold-deep" aria-hidden="true" />
          Screened VukaTV tutors
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          Every tutor below passed our full screening: verified ID and transcript, intro video,
          and two marked 30-mark subject papers. Book a session after creating a free account.
        </p>

        {loading ? (
          <p className="mt-8 text-sm text-ink-soft">Loading tutors…</p>
        ) : tutors.length === 0 ? (
          <div className="card-playbill mt-8 p-6 text-center">
            <p className="font-semibold">Our first tutors are completing screening right now.</p>
            <p className="mt-1 text-sm text-ink-soft">
              Check back soon — or <Link to="/login" className="text-gold-deep underline">apply to become a tutor</Link>.
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {tutors.map((t) => {
              const subjects = [...(t.subjects?.highschool ?? []), ...(t.subjects?.varsity ?? [])];
              const mine = reviews.filter((r) => r.tutor_id === t.id).slice(0, 3);
              return (
                <li key={t.id} className="card-playbill p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">{t.full_name ?? 'VukaTV Tutor'}</h2>
                      {t.province && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
                          <MapPin className="h-3 w-3" aria-hidden="true" /> {t.province}
                        </p>
                      )}
                    </div>
                    {t.rating_count > 0 ? (
                      <span className="flex flex-col items-end gap-0.5">
                        <Stars value={t.rating_avg} />
                        <span className="text-xs text-ink-soft">{t.rating_avg} · {t.rating_count} review{t.rating_count === 1 ? '' : 's'}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-ink-soft">New tutor</span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {subjects.slice(0, 6).map((s) => (
                      <span key={s} className="border border-sand bg-white px-2 py-0.5 text-xs text-ink-soft">{s}</span>
                    ))}
                    {subjects.length > 6 && (
                      <span className="px-1 py-0.5 text-xs text-ink-soft">+{subjects.length - 6} more</span>
                    )}
                  </div>
                  {mine.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-sand pt-3">
                      {mine.map((r, i) => (
                        <blockquote key={i} className="text-xs text-ink-soft">
                          <Stars value={r.rating} />
                          <p className="mt-0.5">“{r.comment}”</p>
                        </blockquote>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer className="border-t border-sand py-6 text-center text-xs text-ink-soft">
        <Link to="/about" className="underline">About VukaTV</Link> · South African low-data learning platform
      </footer>
    </div>
  );
}
