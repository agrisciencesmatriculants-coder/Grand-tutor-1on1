import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent as ReactClipboardEvent } from 'react';
import { Flag, ImagePlus, Mic, Radio, Square } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLanguage } from '../../lib/language';
import type { Classroom } from '../../lib/types';
import { cn, safeUrl } from '../../lib/utils';

const BUCKET = 'files';
const CLASSROOM_ID = 1;
const CHUNK_MS = 4000; // contract §6: a chunk every 4s while live
const END_CONFIRM_MS = 5000; // "End Session" confirm arm resets after this

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

/** Pull the friendly {error}/{reason} message out of a failed edge-function call. */
async function invokeErrorMessage(error: unknown): Promise<string> {
  const err = error as { message?: string; context?: Response } | null;
  if (err?.context && typeof err.context.json === 'function') {
    try {
      const body = (await err.context.json()) as { error?: string; reason?: string };
      if (body && typeof body.error === 'string') return body.error;
      if (body && typeof body.reason === 'string') return body.reason;
    } catch {
      /* fall through */
    }
  }
  return err?.message ?? 'The summary could not be written right now.';
}

type EndPhase = 'idle' | 'confirm' | 'working' | 'done' | 'error';

/** The shared classroom presentation: slides + George's live audio broadcast. */
export default function LiveStage() {
  const { role } = useAuth();
  const { lang } = useLanguage();
  const isTeacher = role === 'teacher';

  const [room, setRoom] = useState<Classroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [endPhase, setEndPhase] = useState<EndPhase>('idle');
  const [endMessage, setEndMessage] = useState<string | null>(null);

  const slideInputRef = useRef<HTMLInputElement>(null);
  const endConfirmTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveRef = useRef(false);
  const seqRef = useRef(0);
  const lastPlayedSeqRef = useRef(0);

  // Initial read + realtime sync on the single classroom row (contract §6).
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;

    client
      .from('classroom')
      .select('*')
      .eq('id', CLASSROOM_ID)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(`Could not load the presentation: ${err.message}`);
        else if (data) {
          setRoom(data as Classroom);
          seqRef.current = (data as Classroom).live_audio_seq ?? 0;
        }
        setLoading(false);
      });

    const channel = client
      .channel('stage-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'classroom',
          filter: `id=eq.${CLASSROOM_ID}`,
        },
        (payload) => setRoom(payload.new as Classroom),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  const setSlide = useCallback(
    async (file: File) => {
      if (!supabase || !isTeacher) return;
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isImage && !isPdf) {
        setError('Slides must be an image or a PDF.');
        return;
      }
      setError(null);
      setBusy(true);
      const storagePath = `slides/${Date.now()}_${sanitizeName(file.name)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file);
      if (upErr) {
        setError(`Slide upload failed: ${upErr.message}`);
        setBusy(false);
        return;
      }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      const { error: updErr } = await supabase
        .from('classroom')
        .update({
          current_slide_url: pub.publicUrl,
          current_slide_type: isPdf ? 'pdf' : 'image',
        })
        .eq('id', CLASSROOM_ID);
      if (updErr) setError(`Could not present the slide: ${updErr.message}`);
      setBusy(false);
    },
    [isTeacher],
  );

  const clearStage = async () => {
    if (!supabase || !isTeacher) return;
    setError(null);
    const { error: updErr } = await supabase
      .from('classroom')
      .update({ current_slide_url: null, current_slide_type: null })
      .eq('id', CLASSROOM_ID);
    if (updErr) setError(`Could not clear the slide: ${updErr.message}`);
  };

  const onSlideInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void setSlide(file);
    e.target.value = '';
  };

  // Paste-from-clipboard (Ctrl+V image) for the teacher.
  useEffect(() => {
    if (!isTeacher) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find(
        (f) => f.type.startsWith('image/') || f.type === 'application/pdf',
      );
      if (file) {
        e.preventDefault();
        void setSlide(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isTeacher, setSlide]);

  const onPasteZone = (e: ReactClipboardEvent<HTMLDivElement>) => {
    if (!isTeacher) return;
    const file = Array.from(e.clipboardData?.files ?? []).find(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf',
    );
    if (file) {
      e.preventDefault();
      void setSlide(file);
    }
  };

  // ---- Go Live audio broadcast (contract §6) ----
  const startLive = async () => {
    if (!supabase || !isTeacher || liveRef.current) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      seqRef.current = room?.live_audio_seq ?? 0;
      liveRef.current = true;

      recorder.ondataavailable = (event: BlobEvent) => {
        // Skip the trailing chunk fired by stop() after we have signed off.
        if (!liveRef.current || !supabase || event.data.size === 0) return;
        const seq = ++seqRef.current;
        const blob = event.data;
        void (async () => {
          const path = `live/${seq}.webm`;
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(path, blob, { contentType: 'audio/webm', upsert: true });
          if (upErr) return;
          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
          await supabase
            .from('classroom')
            .update({ live_audio_url: pub.publicUrl, live_audio_seq: seq })
            .eq('id', CLASSROOM_ID);
        })();
      };

      recorder.start(CHUNK_MS);
      setLive(true);
    } catch {
      setError('Microphone access was denied. Live audio cannot start.');
    }
  };

  const stopLive = async () => {
    if (!supabase) return;
    liveRef.current = false;
    setLive(false);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const { error: updErr } = await supabase
      .from('classroom')
      .update({ live_audio_url: null, live_audio_seq: 0 })
      .eq('id', CLASSROOM_ID);
    if (updErr) setError(`Could not end the live broadcast: ${updErr.message}`);
  };

  // Stop recorder + mic tracks on unmount.
  useEffect(
    () => () => {
      liveRef.current = false;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (endConfirmTimerRef.current !== null) window.clearTimeout(endConfirmTimerRef.current);
    },
    [],
  );

  // ---- End Session (contract §12): inline confirm → session-summary → inline result ----
  const disarmEndConfirm = useCallback(() => {
    if (endConfirmTimerRef.current !== null) {
      window.clearTimeout(endConfirmTimerRef.current);
      endConfirmTimerRef.current = null;
    }
  }, []);

  const runSessionSummary = useCallback(async () => {
    if (!supabase) return;
    disarmEndConfirm();
    setEndPhase('working');
    setEndMessage(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('session-summary', {
        body: { language: lang },
      });
      if (fnErr) throw fnErr;
      if (data && typeof data === 'object' && (data as { ok?: unknown }).ok === false) {
        const reason = (data as { reason?: unknown }).reason;
        setEndPhase('error');
        setEndMessage(typeof reason === 'string' ? reason : 'The summary could not be written.');
        return;
      }
      setEndPhase('done');
      setEndMessage('Summary sent to both email inboxes.');
    } catch (err) {
      setEndPhase('error');
      setEndMessage(await invokeErrorMessage(err));
    }
  }, [disarmEndConfirm]);

  const onEndSessionClick = useCallback(() => {
    if (endPhase === 'working') return;
    if (endPhase !== 'confirm') {
      // First click arms the confirm; it disarms itself after a few seconds.
      setEndPhase('confirm');
      setEndMessage(null);
      disarmEndConfirm();
      endConfirmTimerRef.current = window.setTimeout(
        () => setEndPhase((phase) => (phase === 'confirm' ? 'idle' : phase)),
        END_CONFIRM_MS,
      );
      return;
    }
    void runSessionSummary();
  }, [endPhase, disarmEndConfirm, runSessionSummary]);

  // Student side: auto-play each new live chunk (contract §6).
  useEffect(() => {
    if (isTeacher) return;
    const url = safeUrl(room?.live_audio_url);
    const seq = room?.live_audio_seq ?? 0;
    if (!url || seq === 0) {
      lastPlayedSeqRef.current = 0;
      setNeedsTap(false);
      return;
    }
    if (seq === lastPlayedSeqRef.current) return;
    lastPlayedSeqRef.current = seq;
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = url;
    audio
      .play()
      .then(() => setNeedsTap(false))
      .catch(() => setNeedsTap(true)); // browser autoplay policy
  }, [room, isTeacher]);

  const tapToHear = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio
      .play()
      .then(() => setNeedsTap(false))
      .catch(() => setNeedsTap(true));
  };

  const slideUrl = safeUrl(room?.current_slide_url);
  const slideType = room?.current_slide_type ?? null;
  const liveOnAir = live || !!room?.live_audio_url;

  if (!supabase) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-ink-soft">The presentation view is available once Supabase is configured.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" onPaste={onPasteZone}>
      {/* Status / controls bar */}
      <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
        {liveOnAir && (
          <span
            className={cn(
              'font-label inline-flex items-center gap-1.5 rounded-full border border-terra/60 bg-terra-tint px-2.5 py-1 text-[10px] text-terra-deep',
              'animate-pulse',
            )}
          >
            <Radio className="h-3 w-3" aria-hidden="true" />
            LIVE
          </span>
        )}
        {busy && <span className="font-label text-[10px] text-gold-deep">Uploading slide…</span>}
        {endPhase === 'working' && (
          <span className="font-label inline-flex items-center gap-1.5 text-[10px] text-gold-deep" role="status">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gold/25 border-t-gold" />
            Agron is writing the summary…
          </span>
        )}
        {endPhase === 'done' && endMessage && (
          <span className="font-label text-[10px] normal-case text-sage-deep" role="status">
            {endMessage}
          </span>
        )}
        {endPhase === 'error' && endMessage && (
          <span className="font-label text-[10px] normal-case text-terra-deep" role="alert">
            {endMessage}
          </span>
        )}

        {isTeacher && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => slideInputRef.current?.click()}
              disabled={busy}
              className="btn-ghost px-2.5 py-1 text-xs"
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
              Upload slide
            </button>
            <input
              ref={slideInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={onSlideInput}
            />
            <span
              className="font-label hidden rounded border border-dashed border-sand-deep px-2 py-1 text-[9px] text-ink-soft/70 sm:inline"
              title="Copy an image and press Ctrl+V anywhere to set it as the slide"
            >
              or Ctrl+V paste
            </span>
            {slideUrl && (
              <button
                type="button"
                onClick={() => void clearStage()}
                className="btn-ghost px-2.5 py-1 text-xs"
              >
                Clear slide
              </button>
            )}
            {live ? (
              <button
                type="button"
                onClick={() => void stopLive()}
                className="btn-gold px-3 py-1 text-xs"
              >
                <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                Stop Live
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startLive()}
                className="btn-gold px-3 py-1 text-xs"
              >
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                Go Live
              </button>
            )}
            <button
              type="button"
              onClick={onEndSessionClick}
              disabled={endPhase === 'working'}
              className={cn(
                'btn-ghost px-2.5 py-1 text-xs',
                endPhase === 'confirm' &&
                  'border-terra/60 bg-terra-tint text-terra-deep hover:bg-terra/20',
              )}
              title="Ask Agron to summarise this session and email the summary to George and Kelebogile"
            >
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
              {endPhase === 'confirm' ? 'Confirm — end the session?' : 'End Session'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-2 rounded-md border border-terra/50 bg-terra-tint px-2 py-1.5 text-xs text-terra-deep">
          {error}
        </p>
      )}

      {/* Presentation area */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-sand bg-ivory-deep shadow-[inset_0_0_60px_rgba(201,153,46,0.10)]">
        <div className="spotlight" />
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-ink-soft">Loading…</p>
          </div>
        ) : slideUrl && slideType === 'pdf' ? (
          <iframe
            src={slideUrl}
            title="Current slide"
            className="relative z-10 h-full w-full bg-white"
          />
        ) : slideUrl ? (
          <img
            src={slideUrl}
            alt="Current slide"
            className="relative z-10 h-full w-full object-contain"
          />
        ) : (
          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <img
              src="/assets/empty-stage.png"
              alt="An empty theatre stage under a single spotlight"
              className="max-h-[55%] w-auto rounded-lg border border-sand bg-paper object-contain p-2 opacity-90"
            />
            <p className="font-display text-lg text-ink">
              {isTeacher
                ? 'Upload or paste a slide to begin the presentation.'
                : 'No presentation is currently active. Please wait for your teacher to begin.'}
            </p>
          </div>
        )}
      </div>

      {/* Student live-audio player (hidden) + autoplay fallback */}
      {!isTeacher && (
        <>
          <audio ref={audioRef} className="hidden" aria-hidden="true" />
          {needsTap && (
            <button
              type="button"
              onClick={tapToHear}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-terra/60 bg-terra-tint px-3 py-1.5 text-xs text-terra-deep transition hover:bg-terra/20"
            >
              <Radio className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
              Your teacher is live — tap to listen
            </button>
          )}
        </>
      )}
    </div>
  );
}
