import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenText, Clock, HardDrive, Radio, Tv } from 'lucide-react';
import { supabase } from '../lib/supabase';
import QuizLink from '../features/quiz/QuizLink';
import type { Broadcast, StaffPost } from '../lib/types';
import { formatBytes, formatDuration } from '../lib/telegraph';
import { cn } from '../lib/utils';

type AirState = 'live' | 'upcoming' | 'past';

function airState(b: Broadcast, now: number): AirState {
  const start = new Date(b.airs_at).getTime();
  const end = start + (b.telegraph_scripts?.duration_ms ?? 0);
  if (now < start) return 'upcoming';
  if (now >= start && now < end) return 'live';
  return 'past';
}

function formatAirTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TvGuide() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [talk, setTalk] = useState<StaffPost | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('broadcasts')
      .select('*, telegraph_scripts(*)')
      .order('airs_at', { ascending: false })
      .limit(100);
    if (err) setError(err.message);
    else setBroadcasts((data ?? []) as Broadcast[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    // Principal's daily talk (Phase 9).
    (async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from('staff_posts')
        .select('*')
        .eq('kind', 'daily_talk')
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) setTalk(data[0] as StaffPost);
    })();
  }, [load]);

  const live = broadcasts.filter((b) => airState(b, now) === 'live');
  const upcoming = broadcasts
    .filter((b) => airState(b, now) === 'upcoming')
    .sort((a, b) => new Date(a.airs_at).getTime() - new Date(b.airs_at).getTime());
  const past = broadcasts.filter((b) => airState(b, now) === 'past');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-ink">
          <Tv className="h-6 w-6 text-gold-deep" aria-hidden="true" />
          VukaTV
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Lessons that air like television — drawn live on your screen from a lightweight script,
          so a full lesson costs kilobytes, not megabytes.
        </p>
      </header>

      {talk && (
        <section className="card-playbill border-l-4 border-l-gold p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gold-deep">
            <BookOpenText className="h-4 w-4" aria-hidden="true" />
            The Principal's morning talk — {talk.author_name}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{talk.body}</p>
        </section>
      )}

      {error && (
        <div className="rounded-md border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-soft">Loading the programme guide…</p>
      ) : broadcasts.length === 0 ? (
        <div className="card-playbill p-8 text-center">
          <p className="font-display text-lg font-semibold text-ink">Nothing scheduled yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            Broadcasts will appear here once a teacher schedules a lesson.
          </p>
        </div>
      ) : (
        <>
          <BroadcastSection title="On air now" items={live} now={now} highlight />
          <BroadcastSection title="Coming up" items={upcoming} now={now} />
          <BroadcastSection title="Replay library" items={past} now={now} />
        </>
      )}
    </div>
  );
}

function BroadcastSection({
  title,
  items,
  now,
  highlight = false,
}: {
  title: string;
  items: Broadcast[];
  now: number;
  highlight?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="font-display mb-3 text-lg font-semibold text-ink">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((b) => (
          <BroadcastCard key={b.id} broadcast={b} now={now} highlight={highlight} />
        ))}
      </ul>
    </section>
  );
}

function BroadcastCard({
  broadcast: b,
  now,
  highlight,
}: {
  broadcast: Broadcast;
  now: number;
  highlight: boolean;
}) {
  const state = airState(b, now);
  const script = b.telegraph_scripts;
  return (
    <li>
      <Link
        to={`/tv/${b.id}`}
        className={cn(
          'card-playbill block p-4 transition hover:shadow-md',
          highlight && 'border-gold shadow-[0_0_0_1px_rgba(201,153,46,0.5)]',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatAirTime(b.airs_at)}
          </span>
          {state === 'live' && (
            <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-gold-deep">
              <Radio className="h-3 w-3 animate-pulse" aria-hidden="true" /> Live
            </span>
          )}
          {state === 'upcoming' && (
            <span className="rounded-full bg-sand/60 px-2 py-0.5 text-xs font-medium text-ink-soft">
              Upcoming
            </span>
          )}
          {state === 'past' && (
            <span className="rounded-full bg-sand/60 px-2 py-0.5 text-xs font-medium text-ink-soft">
              Replay
            </span>
          )}
        </div>
        <p className="font-display mt-2 truncate text-base font-semibold text-ink">
          {b.title ?? script?.title ?? 'Untitled lesson'}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
          {script?.subject && <span>{script.subject}</span>}
          {script?.grade && <span>{script.grade}</span>}
          <span>{formatDuration(script?.duration_ms ?? 0)}</span>
          {typeof script?.size_bytes === 'number' && (
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" aria-hidden="true" />
              {formatBytes(script.size_bytes)}
            </span>
          )}
        </p>
        <QuizLink scriptId={b.script_id} />
      </Link>
    </li>
  );
}
