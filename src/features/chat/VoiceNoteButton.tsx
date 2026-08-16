import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface VoiceNoteButtonProps {
  /** Called with the finished audio/webm blob when recording stops. */
  onRecorded: (blob: Blob) => void;
  /** Called with a user-friendly message when recording cannot start. */
  onError: (message: string) => void;
  disabled?: boolean;
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Record/stop toggle button using MediaRecorder (audio/webm) with a pulsing crimson state + timer. */
export default function VoiceNoteButton({ onRecorded, onError, disabled }: VoiceNoteButtonProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const releaseResources = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };

  // Stop mic + timer on unmount (no setState after unmount, no leaked tracks).
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const start = async () => {
    if (recording || disabled) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('Voice notes are not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        releaseResources();
        setRecording(false);
        setElapsed(0);
        if (blob.size > 0) onRecorded(blob);
      };
      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      releaseResources();
      setRecording(false);
      onError('Microphone access was denied — the mic stays offstage.');
    }
  };

  const stop = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop(); // onstop handler delivers the blob + cleans up
    } else {
      releaseResources();
      setRecording(false);
      setElapsed(0);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {recording && (
        <span className="font-label flex items-center gap-1.5 text-[10px] text-crimson-light">
          <span className="inline-block h-2 w-2 animate-ping rounded-full bg-crimson-light" />
          {formatElapsed(elapsed)}
        </span>
      )}
      <button
        type="button"
        onClick={() => (recording ? stop() : void start())}
        disabled={disabled && !recording}
        aria-label={recording ? 'Stop recording' : 'Record a voice note'}
        title={recording ? 'Stop recording' : 'Record a voice note'}
        className={cn(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm transition',
          recording
            ? 'animate-pulse border-crimson-light bg-crimson/30 text-crimson-light shadow-[0_0_16px_rgba(200,86,90,0.45)]'
            : 'border-gold/30 bg-gold/5 text-gold-light hover:bg-gold/15',
          disabled && !recording && 'cursor-not-allowed opacity-50',
        )}
      >
        {recording ? (
          <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        ) : (
          <Mic className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
