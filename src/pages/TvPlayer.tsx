import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Clock, Pause, Play, Radio, Rewind, Tv } from 'lucide-react';
import { supabase } from '../lib/supabase';
import QuizLink from '../features/quiz/QuizLink';
import PastPapersModal from '../features/swipe/PastPapersModal';
import { SwipeCoachMarks, TutorSwitchButtons, useCoachMarks } from '../features/swipe/SwipeCoach';
import { useArcSwipe } from '../features/swipe/useArcSwipe';
import type { Broadcast, TelegraphScriptData } from '../lib/types';
import {
  drawStroke,
  drawUpTo,
  formatDuration,
  parseScript,
  TELEGRAPH_LOGICAL_HEIGHT,
  TELEGRAPH_LOGICAL_WIDTH,
} from '../lib/telegraph';
import { cn } from '../lib/utils';

const PAPER = '#fffdf7';
const SPEEDS = [1, 1.5, 2];

type Phase = 'loading' | 'countdown' | 'live' | 'replay' | 'error';

export default function TvPlayer() {
  const { broadcastId } = useParams<{ broadcastId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [script, setScript] = useState<TelegraphScriptData | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [offsetMs, setOffsetMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Arc-Swipe (Phase 3): sibling tutors + past papers + coach marks.
  const [siblings, setSiblings] = useState<Broadcast[]>([]);
  const [switchNote, setSwitchNote] = useState<string | null>(null);
  const [showPastPapers, setShowPastPapers] = useState(false);
  const [coachSeen, dismissCoach] = useCoachMarks();
  const [coachOpen, setCoachOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number | null>(null);
  const drawnUpToRef = useRef(0); // strokes applied up to this t (ms)
  const airsAtRef = useRef(0);
  const scriptRef = useRef<TelegraphScriptData | null>(null);
  const phaseRef = useRef<Phase>('loading');
  phaseRef.current = phase;

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // --- Arc-Swipe: sibling tutors on the same subject, tutor switching ---
  const subject = broadcast?.telegraph_scripts?.subject ?? null;

  useEffect(() => {
    if (!supabase || !subject) return;
    let cancelled = false;
    supabase
      .from('broadcasts')
      .select('*, telegraph_scripts(*)')
      .lte('airs_at', new Date().toISOString())
      .order('airs_at', { ascending: false })
      .limit(60)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const sameSubject = (data as Broadcast[]).filter(
          (b) =>
            b.id !== broadcastId &&
            (b.telegraph_scripts?.subject ?? '').toLowerCase() === subject.toLowerCase(),
        );
        setSiblings(sameSubject);
      });
    return () => {
      cancelled = true;
    };
  }, [broadcastId, subject]);

  const switchTutor = useCallback(
    (direction: 1 | -1) => {
      if (siblings.length === 0) {
        setSwitchNote('No other tutor is airing this subject yet.');
        window.setTimeout(() => setSwitchNote(null), 2500);
        return;
      }
      const idx = direction === 1 ? 0 : Math.min(siblings.length - 1, 1);
      const target = siblings[idx];
      navigate(`/tv/${target.id}`);
      setSwitchNote(`Switched to “${target.title ?? target.telegraph_scripts?.title ?? 'another tutor'}”.`);
    },
    [navigate, siblings],
  );

  const openPastPapers = useCallback(() => setShowPastPapers(true), []);

  const swipeRef = useArcSwipe<HTMLDivElement>({
    onSwitchTutor: switchTutor,
    onPastPapers: openPastPapers,
  });

  // Show coach marks once, the first time a lesson is watchable.
  useEffect(() => {
    if (!coachSeen && (phase === 'live' || phase === 'replay')) setCoachOpen(true);
  }, [coachSeen, phase]);

  /** Draw strokes up to `t` ms, incrementally when possible. */
  const paintTo = useCallback((t: number) => {
    const canvas = canvasRef.current;
    const s = scriptRef.current;
    if (!canvas || !s) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Full redraw when seeking backwards or when a 'clear' sits in the new range.
    let needFull = t < drawnUpToRef.current;
    if (!needFull) {
      for (const stroke of s.strokes) {
        if (stroke.t > t) break;
        if (stroke.t > drawnUpToRef.current && stroke.tool === 'clear') {
          needFull = true;
          break;
        }
      }
    }
    if (needFull) {
      drawUpTo(ctx, s.strokes, t, canvas.width, canvas.height, PAPER);
    } else {
      for (const stroke of s.strokes) {
        if (stroke.t > t) break;
        if (stroke.t <= drawnUpToRef.current) continue;
        drawStroke(ctx, stroke, canvas.width, canvas.height, PAPER);
      }
    }
    drawnUpToRef.current = t;
  }, []);

  // --- load broadcast + script + audio (single download each) ---
  useEffect(() => {
    if (!supabase || !broadcastId) {
      setError('Invalid broadcast link.');
      setPhase('error');
      return;
    }
    let cancelled = false;
    const client = supabase;

    // Reset all playback state when switching to another tutor's broadcast.
    cancelRaf();
    setPhase('loading');
    setError(null);
    setScript(null);
    setBroadcast(null);
    setPlaying(false);
    setOffsetMs(0);
    setAudioReady(false);
    scriptRef.current = null;
    drawnUpToRef.current = 0;
    audioRef.current?.pause();

    async function load() {
      const { data: b, error: bErr } = await client
        .from('broadcasts')
        .select('*, telegraph_scripts(*)')
        .eq('id', broadcastId)
        .maybeSingle();
      if (bErr || !b) throw new Error(bErr?.message ?? 'Broadcast not found.');
      const bc = b as Broadcast;
      if (cancelled) return;
      setBroadcast(bc);
      airsAtRef.current = new Date(bc.airs_at).getTime();

      const scriptPath = bc.telegraph_scripts?.script_path;
      if (!scriptPath) throw new Error('This broadcast has no lesson script.');
      const { data: scriptUrl } = client.storage.from('telegraph').getPublicUrl(scriptPath);
      const res = await fetch(scriptUrl.publicUrl);
      if (!res.ok) throw new Error('Could not download the lesson script.');
      const parsed = parseScript(await res.json());
      if (cancelled) return;
      scriptRef.current = parsed;
      setScript(parsed);

      // Audio (optional)
      const audioPath = bc.telegraph_scripts?.audio_path;
      if (audioPath && audioRef.current) {
        const { data: audioUrl } = client.storage.from('telegraph').getPublicUrl(audioPath);
        audioRef.current.src = audioUrl.publicUrl;
        audioRef.current.preload = 'auto';
        audioRef.current.oncanplaythrough = () => setAudioReady(true);
        audioRef.current.load();
      } else {
        setAudioReady(true);
      }

      const now = Date.now();
      const start = airsAtRef.current;
      const end = start + parsed.durationMs;
      if (now < start) {
        setPhase('countdown');
        setCountdown(start - now);
      } else if (now >= start && now < end) {
        setPhase('live');
      } else {
        setPhase('replay');
      }
    }

    void load().catch((e) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : 'Failed to load the broadcast.');
      setPhase('error');
    });

    return () => {
      cancelled = true;
      cancelRaf();
    };
  }, [broadcastId, cancelRaf]);

  // --- countdown ticker ---
  useEffect(() => {
    if (phase !== 'countdown') return;
    const t = window.setInterval(() => {
      const remain = airsAtRef.current - Date.now();
      setCountdown(Math.max(0, remain));
      if (remain <= 0) setPhase('live');
    }, 500);
    return () => window.clearInterval(t);
  }, [phase]);

  // --- LIVE loop: catch up instantly, then draw in real time ---
  useEffect(() => {
    if (phase !== 'live') return;
    const s = scriptRef.current;
    if (!s) return;

    // Instant catch-up: draw everything that should already be on the board.
    const startOffset = Math.max(0, Date.now() - airsAtRef.current);
    drawnUpToRef.current = 0;
    paintTo(startOffset);

    // Start audio at the same offset once ready.
    const audio = audioRef.current;
    if (audio && audioRef.current?.src) {
      const tryStart = () => {
        const off = Math.max(0, Date.now() - airsAtRef.current) / 1000;
        audio.currentTime = Math.min(off, s.durationMs / 1000);
        void audio.play().catch(() => setPlaying(false));
        setPlaying(true);
      };
      if (audio.readyState >= 3) tryStart();
      else audio.addEventListener('canplaythrough', tryStart, { once: true });
    }

    const tick = () => {
      const t = Date.now() - airsAtRef.current;
      setOffsetMs(Math.max(0, t));
      paintTo(t);
      if (t < s.durationMs + 1000) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPhase('replay');
        setPlaying(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return cancelRaf;
  }, [phase, paintTo, cancelRaf]);

  // --- REPLAY transport ---
  const offsetMsRef = useRef(0);
  offsetMsRef.current = offsetMs;
  // Silent lessons (no audio) replay on a local clock; `silentBase` maps clock → script time.
  const silentBaseRef = useRef<{ clockStart: number; scriptStart: number } | null>(null);

  const replayPlay = useCallback(() => {
    const audio = audioRef.current;
    const s = scriptRef.current;
    if (!s) return;
    setPlaying(true);
    cancelRaf();

    if (audio?.src) {
      audio.playbackRate = speed;
      void audio.play().catch(() => undefined);
      const tick = () => {
        const t = audio.currentTime * 1000;
        setOffsetMs(t);
        paintTo(t);
        if (t < s.durationMs && !audio.paused) rafRef.current = requestAnimationFrame(tick);
        else setPlaying(false);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      silentBaseRef.current = { clockStart: performance.now(), scriptStart: offsetMsRef.current };
      const tick = (now: number) => {
        const base = silentBaseRef.current;
        if (!base) return;
        const t = base.scriptStart + (now - base.clockStart) * speed;
        setOffsetMs(t);
        paintTo(t);
        if (t < s.durationMs) rafRef.current = requestAnimationFrame(tick);
        else setPlaying(false);
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [cancelRaf, paintTo, speed]);

  const replayPause = useCallback(() => {
    audioRef.current?.pause();
    silentBaseRef.current = null;
    setPlaying(false);
    cancelRaf();
  }, [cancelRaf]);

  const replaySeek = useCallback(
    (t: number) => {
      const audio = audioRef.current;
      const s = scriptRef.current;
      if (!s) return;
      setOffsetMs(t);
      if (audio?.src) audio.currentTime = t / 1000;
      if (silentBaseRef.current) {
        silentBaseRef.current = { clockStart: performance.now(), scriptStart: t };
      }
      paintTo(t);
    },
    [paintTo],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  }, [speed]);

  // Keyboard: space toggles play/pause in replay.
  useEffect(() => {
    if (phase !== 'replay') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        if (playing) replayPause();
        else replayPlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, playing, replayPause, replayPlay]);

  const title = broadcast?.title ?? broadcast?.telegraph_scripts?.title ?? 'Broadcast';
  const durationMs = script?.durationMs ?? 0;

  return (
    <div className="space-y-5">
      <Link to="/tv" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the guide
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-ink">
          <Tv className="h-6 w-6 text-gold-deep" aria-hidden="true" />
          {title}
        </h1>
        {phase === 'live' && (
          <span className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gold-deep">
            <Radio className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" /> Live
          </span>
        )}
      </header>

      {phase === 'error' && (
        <div className="card-playbill p-8 text-center">
          <p className="font-display text-lg font-semibold text-ink">Broadcast unavailable</p>
          <p className="mt-1 text-sm text-ink-soft">{error}</p>
        </div>
      )}

      {phase === 'loading' && (
        <div className="card-playbill p-8 text-center text-sm text-ink-soft">
          Loading the broadcast…
        </div>
      )}

      {phase === 'countdown' && (
        <div className="card-playbill p-10 text-center">
          <p className="font-display text-lg font-semibold text-ink">This lesson has not aired yet</p>
          <p className="mt-2 flex items-center justify-center gap-2 text-sm text-ink-soft">
            <Clock className="h-4 w-4" aria-hidden="true" />
            Begins in {formatDuration(countdown)}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Stay on this page — the lesson starts automatically.
          </p>
        </div>
      )}

      {(phase === 'live' || phase === 'replay') && (
        <section className="card-playbill p-4 sm:p-6">
          <div
            ref={swipeRef}
            className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-sand shadow-sm"
            style={{ touchAction: 'pan-y' }}
            title="Bowl-swipe to switch tutor; diagonal swipe for past papers"
          >
            <canvas
              ref={canvasRef}
              width={TELEGRAPH_LOGICAL_WIDTH}
              height={TELEGRAPH_LOGICAL_HEIGHT}
              className="block h-auto w-full bg-[#fffdf7]"
            />
            {switchNote && (
              <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink/85 px-4 py-1.5 text-xs text-ivory shadow-lg" role="status">
                {switchNote}
              </div>
            )}
          </div>
          <audio ref={audioRef} className="hidden" />

          <div className="mx-auto mt-3 flex max-w-5xl flex-wrap items-center gap-2">
            <TutorSwitchButtons onSwitch={switchTutor} disabled={siblings.length === 0} />
            <button
              type="button"
              onClick={openPastPapers}
              className="btn-ghost flex items-center gap-1 px-2.5 py-1.5 text-xs"
              title="Open DBE past papers (or diagonal-swipe on the board)"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" /> Past papers
            </button>
          </div>

          <div className="mx-auto mt-4 flex max-w-5xl flex-wrap items-center gap-3">
            {phase === 'live' ? (
              <>
                <span className="font-mono text-sm text-ink">
                  {formatDuration(offsetMs)} / {formatDuration(durationMs)}
                </span>
                {!audioReady && (
                  <span className="text-xs text-ink-soft">Audio is buffering; the board is live.</span>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={playing ? replayPause : replayPlay}
                  className="btn-gold flex items-center gap-2 px-4 py-2 text-sm"
                  aria-label={playing ? 'Pause' : 'Play'}
                >
                  {playing ? (
                    <Pause className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Play className="h-4 w-4" aria-hidden="true" />
                  )}
                  {playing ? 'Pause' : 'Play'}
                </button>
                <button
                  type="button"
                  onClick={() => replaySeek(0)}
                  className="btn-ghost flex items-center gap-1 px-3 py-2 text-sm"
                  aria-label="Restart"
                >
                  <Rewind className="h-4 w-4" aria-hidden="true" />
                </button>
                <input
                  type="range"
                  min={0}
                  max={durationMs}
                  step={250}
                  value={Math.min(offsetMs, durationMs)}
                  onChange={(e) => replaySeek(Number(e.target.value))}
                  className="min-w-[10rem] flex-1 accent-gold"
                  aria-label="Seek"
                />
                <span className="font-mono text-xs text-ink-soft">
                  {formatDuration(offsetMs)} / {formatDuration(durationMs)}
                </span>
                <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      className={cn(
                        'rounded-md border px-2 py-1 text-xs font-semibold',
                        speed === s
                          ? 'border-gold bg-gold/15 text-gold-deep'
                          : 'border-sand text-ink-soft hover:bg-gold/10',
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {phase === 'replay' && broadcast && (
            <div className="mx-auto max-w-5xl">
              <QuizLink scriptId={broadcast.script_id} block />
            </div>
          )}
        </section>
      )}

      {showPastPapers && (
        <PastPapersModal subject={subject} onClose={() => setShowPastPapers(false)} />
      )}
      {coachOpen && (
        <SwipeCoachMarks
          onDismiss={() => {
            dismissCoach();
            setCoachOpen(false);
          }}
        />
      )}
    </div>
  );
}
