import { useEffect, useRef } from 'react';

/**
 * Arc-Swipe Engine (Phase 3).
 *
 * Gesture vocabulary on a touch/pointer surface:
 *   - BOWL SWIPE (an arc: start and end at similar height, path dips or humps
 *     in the middle, clear horizontal travel): switch tutor on the same topic.
 *     dx > 0 → next tutor, dx < 0 → previous tutor.
 *   - DIAGONAL SWIPE (strong travel on both axes): open the DBE past-paper
 *     launcher.
 *
 * Everything else is ignored so normal scrolling/tapping is unaffected.
 */

export interface ArcSwipeHandlers {
  onSwitchTutor: (direction: 1 | -1) => void;
  onPastPapers: () => void;
}

interface Sample {
  x: number;
  y: number;
}

const MIN_HORIZONTAL = 140; // px of horizontal travel for a bowl swipe
const MAX_VERTICAL_DRIFT = 90; // start→end vertical drift allowed for a bowl
const MIN_ARC_DEPTH = 55; // mid-path deviation that makes it a "bowl"
const MIN_DIAGONAL = 120; // px on BOTH axes for a diagonal swipe

function classify(samples: Sample[]): 'next' | 'prev' | 'diagonal' | null {
  if (samples.length < 4) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;

  // Diagonal launcher: strong travel on both axes, roughly diagonal ratio.
  if (Math.abs(dx) >= MIN_DIAGONAL && Math.abs(dy) >= MIN_DIAGONAL) {
    const ratio = Math.abs(dx) / Math.abs(dy);
    if (ratio > 0.4 && ratio < 2.5) return 'diagonal';
  }

  // Bowl swipe: horizontal travel, ends level, arc dips/humps mid-path.
  if (Math.abs(dx) >= MIN_HORIZONTAL && Math.abs(dy) <= MAX_VERTICAL_DRIFT) {
    let maxDeviation = 0;
    for (const s of samples) {
      maxDeviation = Math.max(maxDeviation, Math.abs(s.y - first.y));
    }
    if (maxDeviation >= MIN_ARC_DEPTH) return dx > 0 ? 'next' : 'prev';
  }

  return null;
}

/**
 * Attaches the arc-swipe recogniser to an element. Returns a ref to place on
 * the gesture surface (the player stage). Recogniser is pointer-based, so it
 * works for touch, pen and mouse.
 */
export function useArcSwipe<T extends HTMLElement>(handlers: ArcSwipeHandlers) {
  const ref = useRef<T | null>(null);
  const samplesRef = useRef<Sample[]>([]);
  const trackingRef = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      // Don't hijack drags on interactive controls (sliders, buttons).
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, select, textarea, audio')) return;
      trackingRef.current = true;
      samplesRef.current = [{ x: e.clientX, y: e.clientY }];
    };
    const onMove = (e: PointerEvent) => {
      if (!trackingRef.current) return;
      const samples = samplesRef.current;
      const last = samples[samples.length - 1];
      // Sample at most ~every 12px of movement to keep the path light.
      if (Math.hypot(e.clientX - last.x, e.clientY - last.y) >= 12) {
        samples.push({ x: e.clientX, y: e.clientY });
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!trackingRef.current) return;
      trackingRef.current = false;
      samplesRef.current.push({ x: e.clientX, y: e.clientY });
      const result = classify(samplesRef.current);
      samplesRef.current = [];
      if (result === 'next') handlersRef.current.onSwitchTutor(1);
      else if (result === 'prev') handlersRef.current.onSwitchTutor(-1);
      else if (result === 'diagonal') handlersRef.current.onPastPapers();
    };

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  return ref;
}
