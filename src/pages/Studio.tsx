import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  Circle,
  CircleHelp,
  Clock,
  Download,
  Eraser,
  HardDrive,
  Mic,
  Pause,
  Play,
  Radio,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTutorStatus } from '../lib/tutorStatus';
import { supabase } from '../lib/supabase';
import QuizBuilder from '../features/quiz/QuizBuilder';
import StudioAnalytics from '../features/studio/StudioAnalytics';
import AiTitleSuggest from '../features/studio/AiTitleSuggest';
import type { TelegraphScriptRow, TelegraphStroke, TelegraphTool } from '../lib/types';
import {
  buildScript,
  drawStroke,
  drawUpTo,
  formatBytes,
  formatDuration,
  prepCanvas,
  q,
  scriptToBlob,
  TELEGRAPH_LOGICAL_HEIGHT,
  TELEGRAPH_LOGICAL_WIDTH,
} from '../lib/telegraph';
import { cn } from '../lib/utils';

const PEN_COLORS = [
  { name: 'Umber', value: '#3a2f1d' },
  { name: 'Gold', value: '#a07c1f' },
  { name: 'Terracotta', value: '#b4664a' },
  { name: 'Sage', value: '#7d8c5c' },
];
const PEN_SIZES = [2, 4, 7];
const PAPER = '#fffdf7';

type RecState = 'idle' | 'recording' | 'paused' | 'stopped';

interface SavedMeta {
  title: string;
  subject: string;
  grade: string;
  topic: string;
}

/** Pick the best supported audio mime type for MediaRecorder. */
function pickAudioMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=opus',
    'audio/mp4',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

export default function Studio() {
  const { profile, role } = useAuth();
  const { approved: approvedTutor, loading: tutorLoading } = useTutorStatus();

  // --- recording state ---
  const [recState, setRecState] = useState<RecState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [strokes, setStrokes] = useState<TelegraphStroke[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- tool state ---
  const [tool, setTool] = useState<TelegraphTool>('pen');
  const [color, setColor] = useState(PEN_COLORS[0].value);
  const [size, setSize] = useState(4);

  // --- save meta ---
  const [meta, setMeta] = useState<SavedMeta>({ title: '', subject: '', grade: '', topic: '' });
  const [saving, setSaving] = useState(false);
  const [savedStats, setSavedStats] = useState<string | null>(null);

  // --- my scripts + scheduling ---
  const [myScripts, setMyScripts] = useState<TelegraphScriptRow[]>([]);
  const [scheduleFor, setScheduleFor] = useState<TelegraphScriptRow | null>(null);
  const [quizFor, setQuizFor] = useState<TelegraphScriptRow | null>(null);
  const [airsAt, setAirsAt] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [preview, setPreview] = useState<TelegraphScriptRow | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<TelegraphStroke | null>(null);
  const startRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const pauseStartRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const nowMs = useCallback(() => {
    return Math.max(0, Date.now() - startRef.current - pausedTotalRef.current);
  }, []);

  // Estimated live size: script JSON so far + audio chunks so far.
  const estBytes = useMemo(() => {
    const scriptBytes = JSON.stringify(buildScript(strokes, elapsedMs)).length;
    const audioBytes = chunksRef.current.reduce((n, b) => n + b.size, 0);
    return scriptBytes + audioBytes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, elapsedMs, audioBlob]);

  // --- canvas helpers ---
  const drawAll = useCallback((list: TelegraphStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = prepCanvas(canvas, PAPER);
    if (!ctx) return;
    for (const s of list) drawStroke(ctx, s, canvas.width, canvas.height, PAPER);
  }, []);

  const pointFromEvent = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = q(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
    const y = q(Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)));
    return [x, y] as [number, number];
  }, []);

  // --- pointer handlers (work idle or recording; only recording persists strokes) ---
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (recState !== 'recording') return;
      const pt = pointFromEvent(e);
      if (!pt) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      drawingRef.current = true;
      if (tool === 'clear') {
        const stroke: TelegraphStroke = { t: Math.round(nowMs()), tool: 'clear', color, size, pts: [] };
        setStrokes((prev) => {
          const next = [...prev, stroke];
          drawAll(next);
          return next;
        });
        drawingRef.current = false;
        return;
      }
      currentStrokeRef.current = { t: Math.round(nowMs()), tool, color, size, pts: [pt] };
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) drawStroke(ctx, currentStrokeRef.current, canvas.width, canvas.height, PAPER);
    },
    [recState, tool, color, size, nowMs, pointFromEvent, drawAll],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || recState !== 'recording') return;
      const pt = pointFromEvent(e);
      const cur = currentStrokeRef.current;
      if (!pt || !cur) return;
      cur.pts.push(pt);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        drawStroke(ctx, { ...cur, pts: cur.pts.slice(-2) }, canvas.width, canvas.height, PAPER);
      }
    },
    [recState, pointFromEvent],
  );

  const onPointerUp = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const cur = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (cur && cur.pts.length > 0) setStrokes((prev) => [...prev, cur]);
  }, []);

  // --- timer ---
  const startTimer = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => setElapsedMs(nowMs()), 250);
  }, [nowMs]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // --- recording controls ---
  const startRecording = useCallback(async () => {
    setError(null);
    setSavedStats(null);
    if (!supabase || !profile) return;
    const mime = pickAudioMime();
    if (!mime) {
      setError('Audio recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.start(1000);
      setStrokes([]);
      setAudioBlob(null);
      setElapsedMs(0);
      startRef.current = Date.now();
      pausedTotalRef.current = 0;
      setRecState('recording');
      startTimer();
      const canvas = canvasRef.current;
      if (canvas) prepCanvas(canvas, PAPER);
    } catch {
      setError('Microphone access was denied. Please allow microphone access to record a lesson.');
    }
  }, [profile, startTimer]);

  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.pause();
    pauseStartRef.current = Date.now();
    stopTimer();
    setRecState('paused');
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === 'paused') recorderRef.current.resume();
    pausedTotalRef.current += Date.now() - pauseStartRef.current;
    setRecState('recording');
    startTimer();
  }, [startTimer]);

  const stopRecording = useCallback(() => {
    stopTimer();
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        setAudioBlob(blob);
      };
      rec.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    const finalMs = nowMs();
    setElapsedMs(finalMs);
    setRecState('stopped');
  }, [nowMs, stopTimer]);

  // --- cleanup on unmount ---
  useEffect(() => {
    return () => {
      stopTimer();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopTimer]);

  // --- load my scripts ---
  const loadScripts = useCallback(async () => {
    if (!supabase || !profile) return;
    const { data, error: err } = await supabase
      .from('telegraph_scripts')
      .select('*')
      .eq('tutor_id', profile.id)
      .order('created_at', { ascending: false });
    if (!err && data) setMyScripts(data as TelegraphScriptRow[]);
  }, [profile]);

  useEffect(() => {
    void loadScripts();
  }, [loadScripts]);

  // --- save (upload + insert) ---
  const saveLesson = useCallback(async () => {
    if (!supabase || !profile || recState !== 'stopped') return;
    if (!meta.title.trim()) {
      setError('Please give the lesson a title before saving.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const script = buildScript(strokes, elapsedMs);
      const scriptBlob = scriptToBlob(script);
      const scriptId = crypto.randomUUID();
      const audioPath = `audio/${scriptId}.webm`;
      const scriptPath = `scripts/${scriptId}.json`;
      const totalBytes = scriptBlob.size + (audioBlob?.size ?? 0);

      if (audioBlob) {
        const { error: upErr } = await supabase.storage
          .from('telegraph')
          .upload(audioPath, audioBlob, { contentType: audioBlob.type || 'audio/webm' });
        if (upErr) throw upErr;
      }
      const { error: upErr2 } = await supabase.storage
        .from('telegraph')
        .upload(scriptPath, scriptBlob, { contentType: 'application/json' });
      if (upErr2) throw upErr2;

      const { error: insErr } = await supabase.from('telegraph_scripts').insert({
        id: scriptId,
        tutor_id: profile.id,
        title: meta.title.trim(),
        subject: meta.subject.trim() || null,
        grade: meta.grade.trim() || null,
        topic: meta.topic.trim() || null,
        duration_ms: Math.round(elapsedMs),
        audio_path: audioBlob ? audioPath : null,
        script_path: scriptPath,
        size_bytes: totalBytes,
      });
      if (insErr) throw insErr;

      setSavedStats(
        `Saved. This ${formatDuration(elapsedMs)} lesson costs a student about ${formatBytes(totalBytes)} of data.`,
      );
      setRecState('idle');
      setStrokes([]);
      setAudioBlob(null);
      setElapsedMs(0);
      setMeta({ title: '', subject: '', grade: '', topic: '' });
      const canvas = canvasRef.current;
      if (canvas) prepCanvas(canvas, PAPER);
      void loadScripts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save the lesson.');
    } finally {
      setSaving(false);
    }
  }, [audioBlob, elapsedMs, loadScripts, meta, profile, recState, strokes]);

  // --- schedule a broadcast ---
  const scheduleBroadcast = useCallback(async () => {
    if (!supabase || !profile || !scheduleFor || !airsAt) return;
    setScheduling(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('broadcasts').insert({
        script_id: scheduleFor.id,
        airs_at: new Date(airsAt).toISOString(),
        title: scheduleFor.title,
        created_by: profile.id,
      });
      if (err) throw err;
      setScheduleFor(null);
      setAirsAt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to schedule the broadcast.');
    } finally {
      setScheduling(false);
    }
  }, [airsAt, profile, scheduleFor]);

  if (role !== 'teacher') {
    return (
      <div className="card-playbill mx-auto max-w-xl p-8 text-center">
        <h1 className="font-display text-xl font-bold text-ink">Studio access</h1>
        <p className="mt-2 text-sm text-ink-soft">
          The Telegraph Studio is available to teachers only. Visit VukaTV to watch scheduled
          broadcasts.
        </p>
      </div>
    );
  }

  // Phase 6: only screened, approved tutors may create content.
  if (!tutorLoading && !approvedTutor) {
    return (
      <div className="card-playbill mx-auto max-w-xl p-8 text-center">
        <h1 className="font-display text-xl font-bold text-ink">Complete your tutor screening</h1>
        <p className="mt-2 text-sm text-ink-soft">
          The Studio unlocks once your tutor application is approved. The screening covers your
          motivation, subjects, availability, intro video, documents and a prove-your-subject test.
        </p>
        <Link to="/apply" className="btn-gold mt-4 inline-block">
          Open my tutor application
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-ink">
          <Radio className="h-6 w-6 text-gold-deep" aria-hidden="true" />
          Telegraph Studio
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Record a whiteboard lesson once. It airs on VukaTV as strokes and voice — kilobytes of
          data instead of video megabytes.
        </p>
      </header>

      {/* Tutor analytics (YouTube-Studio-style performance panel) */}
      <StudioAnalytics />

      {error && (
        <div className="rounded-md border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta" role="alert">
          {error}
        </div>
      )}
      {savedStats && (
        <div className="rounded-md border border-sage/50 bg-sage/10 px-4 py-3 text-sm text-ink" role="status">
          {savedStats}
        </div>
      )}

      {/* Whiteboard */}
      <section className="card-playbill p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {/* tools */}
          {PEN_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={`${c.name} pen`}
              aria-label={`${c.name} pen`}
              onClick={() => {
                setTool('pen');
                setColor(c.value);
              }}
              className={cn(
                'h-7 w-7 rounded-full border-2 transition',
                tool === 'pen' && color === c.value ? 'border-gold scale-110' : 'border-sand',
              )}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <span className="mx-1 h-6 w-px bg-sand" aria-hidden="true" />
          {PEN_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              title={`Pen size ${s}`}
              onClick={() => setSize(s)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold',
                size === s ? 'border-gold bg-gold/15 text-gold-deep' : 'border-sand text-ink-soft',
              )}
            >
              {s}
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-sand" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setTool('eraser')}
            className={cn(
              'btn-ghost flex items-center gap-1 px-2 py-1 text-xs',
              tool === 'eraser' && 'bg-gold/15 text-gold-deep',
            )}
          >
            <Eraser className="h-4 w-4" aria-hidden="true" /> Eraser
          </button>
          <button
            type="button"
            onClick={() => setTool('clear')}
            className={cn(
              'btn-ghost flex items-center gap-1 px-2 py-1 text-xs',
              tool === 'clear' && 'bg-terracotta/15 text-terracotta',
            )}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Clear board
          </button>

          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono text-sm text-ink">
              {recState === 'recording' && (
                <Circle className="h-2.5 w-2.5 animate-pulse fill-terracotta text-terracotta" aria-hidden="true" />
              )}
              {formatDuration(elapsedMs)}
            </span>
            <span className="flex items-center gap-1 text-xs text-ink-soft">
              <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
              ~{formatBytes(estBytes)}
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-lg border border-sand shadow-sm" style={{ aspectRatio: '16 / 9' }}>
          <canvas
            ref={canvasRef}
            width={TELEGRAPH_LOGICAL_WIDTH}
            height={TELEGRAPH_LOGICAL_HEIGHT}
            className={cn(
              'h-full w-full touch-none bg-[#fffdf7]',
              recState === 'recording' ? 'cursor-crosshair' : 'cursor-not-allowed opacity-90',
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
          {recState === 'idle' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-md bg-ivory/90 px-4 py-2 text-sm text-ink-soft shadow">
                Press Record to begin a lesson.
              </p>
            </div>
          )}
          {recState === 'paused' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-md bg-ivory/90 px-4 py-2 text-sm text-ink-soft shadow">Paused</p>
            </div>
          )}
        </div>

        {/* transport controls */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {recState === 'idle' && (
            <button type="button" onClick={() => void startRecording()} className="btn-gold flex items-center gap-2 px-4 py-2 text-sm">
              <Mic className="h-4 w-4" aria-hidden="true" /> Record
            </button>
          )}
          {recState === 'recording' && (
            <>
              <button type="button" onClick={pauseRecording} className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm">
                <Pause className="h-4 w-4" aria-hidden="true" /> Pause
              </button>
              <button type="button" onClick={stopRecording} className="btn-gold flex items-center gap-2 px-4 py-2 text-sm">
                <Square className="h-4 w-4" aria-hidden="true" /> Stop
              </button>
            </>
          )}
          {recState === 'paused' && (
            <>
              <button type="button" onClick={resumeRecording} className="btn-gold flex items-center gap-2 px-4 py-2 text-sm">
                <Play className="h-4 w-4" aria-hidden="true" /> Resume
              </button>
              <button type="button" onClick={stopRecording} className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm">
                <Square className="h-4 w-4" aria-hidden="true" /> Stop
              </button>
            </>
          )}
          {recState === 'stopped' && (
            <span className="text-sm text-ink-soft">Recording complete — review the details and save below.</span>
          )}
        </div>

        {/* save form */}
        {recState === 'stopped' && (
          <div className="mt-5 space-y-3 rounded-md border border-sand bg-ivory/60 p-4">
            <h2 className="font-display text-base font-semibold text-ink">Save this lesson</h2>
            <AiTitleSuggest
              topic={meta.topic || meta.title}
              subject={meta.subject}
              grade={meta.grade}
              onPick={(title) => setMeta((m) => ({ ...m, title }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="input-stage"
                placeholder="Lesson title (required)"
                value={meta.title}
                onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
              />
              <input
                className="input-stage"
                placeholder="Subject (e.g. Mathematics)"
                value={meta.subject}
                onChange={(e) => setMeta((m) => ({ ...m, subject: e.target.value }))}
              />
              <input
                className="input-stage"
                placeholder="Grade (e.g. Grade 12)"
                value={meta.grade}
                onChange={(e) => setMeta((m) => ({ ...m, grade: e.target.value }))}
              />
              <input
                className="input-stage"
                placeholder="Topic (e.g. Trigonometry)"
                value={meta.topic}
                onChange={(e) => setMeta((m) => ({ ...m, topic: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveLesson()}
                className="btn-gold flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {saving ? 'Saving…' : `Save lesson (~${formatBytes(estBytes)})`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecState('idle');
                  setStrokes([]);
                  setAudioBlob(null);
                  setElapsedMs(0);
                  const canvas = canvasRef.current;
                  if (canvas) prepCanvas(canvas, PAPER);
                }}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </section>

      {/* My scripts */}
      <section className="card-playbill p-4 sm:p-6">
        <h2 className="font-display mb-3 text-lg font-semibold text-ink">My recorded lessons</h2>
        {myScripts.length === 0 ? (
          <p className="text-sm text-ink-soft">No lessons recorded yet.</p>
        ) : (
          <ul className="divide-y divide-sand">
            {myScripts.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{s.title}</p>
                  <p className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {formatDuration(s.duration_ms ?? 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" aria-hidden="true" />
                      {formatBytes(s.size_bytes ?? 0)}
                    </span>
                    {s.subject && <span>{s.subject}</span>}
                    {s.grade && <span>{s.grade}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreview(s)}
                  className="btn-ghost flex items-center gap-1 px-3 py-1.5 text-xs"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => setQuizFor(s)}
                  className="btn-ghost flex items-center gap-1 px-3 py-1.5 text-xs"
                >
                  <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" /> Quiz
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleFor(s);
                    setAirsAt('');
                  }}
                  className="btn-gold flex items-center gap-1 px-3 py-1.5 text-xs"
                >
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Schedule broadcast
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* schedule modal */}
      {scheduleFor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true">
          <div className="card-playbill w-full max-w-md p-6">
            <div className="flex items-start justify-between">
              <h2 className="font-display text-lg font-semibold text-ink">Schedule broadcast</h2>
              <button type="button" onClick={() => setScheduleFor(null)} aria-label="Close" className="text-ink-soft hover:text-ink">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-soft">“{scheduleFor.title}”</p>
            <label className="mt-4 block text-sm font-medium text-ink">
              Air date and time
              <input
                type="datetime-local"
                className="input-stage mt-1 w-full"
                value={airsAt}
                onChange={(e) => setAirsAt(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={() => setScheduleFor(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!airsAt || scheduling}
                onClick={() => void scheduleBroadcast()}
                className="btn-gold px-4 py-2 text-sm disabled:opacity-60"
              >
                {scheduling ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* preview modal */}
      {preview && <ScriptPreview script={preview} onClose={() => setPreview(null)} />}

      {/* quiz builder modal */}
      {quizFor && (
        <QuizBuilder
          scriptId={quizFor.id}
          scriptTitle={quizFor.title}
          onClose={() => setQuizFor(null)}
        />
      )}
    </div>
  );
}

/** Local replay of a stored telegraph script + audio. */
function ScriptPreview({ script, onClose }: { script: TelegraphScriptRow; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState('Loading…');

  useEffect(() => {
    let cancelled = false;
    if (!supabase || !script.script_path) return;
    const client = supabase;

    async function load() {
      const { data: scriptUrl } = client.storage.from('telegraph').getPublicUrl(script.script_path!);
      const res = await fetch(scriptUrl.publicUrl);
      const json = (await res.json()) as { strokes?: TelegraphStroke[]; durationMs?: number };
      if (cancelled) return;
      const strokes = json.strokes ?? [];
      const canvas = canvasRef.current;
      const audio = audioRef.current;
      if (!canvas) return;
      const ctx = prepCanvas(canvas, PAPER);
      if (!ctx) return;
      setStatus('Ready');

      const drawFrame = () => {
        const t = (audio?.currentTime ?? 0) * 1000;
        drawUpTo(ctx, strokes, t, canvas.width, canvas.height, PAPER);
        rafRef.current = requestAnimationFrame(drawFrame);
      };

      if (audio) {
        const { data: audioUrl } = client.storage.from('telegraph').getPublicUrl(script.audio_path ?? '');
        if (script.audio_path) audio.src = audioUrl.publicUrl;
        audio.onplay = () => {
          setPlaying(true);
          rafRef.current = requestAnimationFrame(drawFrame);
        };
        audio.onpause = () => {
          setPlaying(false);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          drawUpTo(ctx, strokes, (audio.currentTime ?? 0) * 1000, canvas.width, canvas.height, PAPER);
        };
        audio.onseeked = () => {
          drawUpTo(ctx, strokes, audio.currentTime * 1000, canvas.width, canvas.height, PAPER);
        };
      } else {
        // No audio: replay on a simple clock.
        const start = performance.now();
        const tick = (now: number) => {
          drawUpTo(ctx, strokes, now - start, canvas.width, canvas.height, PAPER);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    void load().catch(() => setStatus('Failed to load the recording.'));

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [script]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true">
      <div className="card-playbill w-full max-w-4xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{script.title}</h2>
            <p className="text-xs text-ink-soft">{status}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview" className="text-ink-soft hover:text-ink">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={TELEGRAPH_LOGICAL_WIDTH}
          height={TELEGRAPH_LOGICAL_HEIGHT}
          className="w-full rounded-lg border border-sand bg-[#fffdf7]"
        />
        {script.audio_path && (
          <audio ref={audioRef} controls className="mt-3 w-full" />
        )}
        {!script.audio_path && (
          <p className="mt-2 flex items-center gap-1 text-xs text-ink-soft">
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Silent recording — replaying strokes on a clock.
          </p>
        )}
        {playing && <span className="sr-only">Playing</span>}
      </div>
    </div>
  );
}
