import { BookOpen, ChevronLeft, ChevronRight, MousePointer2, X } from 'lucide-react';
import { useState } from 'react';

/**
 * Coach-marks overlay for the Arc-Swipe gestures (shown once per device),
 * plus the arrow/button fallbacks that are always available.
 */

const COACH_KEY = 'vukatv_swipe_coach_seen';

export function useCoachMarks(): [boolean, () => void] {
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(COACH_KEY) === '1';
    } catch {
      return true;
    }
  });
  const dismiss = () => {
    setSeen(true);
    try {
      localStorage.setItem(COACH_KEY, '1');
    } catch {
      /* storage unavailable — fine */
    }
  };
  return [seen, dismiss];
}

export function SwipeCoachMarks({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true">
      <div className="card-playbill w-full max-w-md p-6">
        <div className="flex items-start justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Two gestures to know</h2>
          <button type="button" onClick={onDismiss} aria-label="Close" className="text-ink-soft hover:text-ink">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <ul className="mt-4 space-y-4 text-sm text-ink-soft">
          <li className="flex items-start gap-3">
            <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-gold-deep" aria-hidden="true" />
            <p>
              <span className="font-semibold text-ink">Bowl swipe</span> — drag in an arc (like
              drawing a smile) across the board to switch to another tutor teaching the same
              subject.
            </p>
          </li>
          <li className="flex items-start gap-3">
            <MousePointer2 className="mt-0.5 h-5 w-5 shrink-0 rotate-90 text-gold-deep" aria-hidden="true" />
            <p>
              <span className="font-semibold text-ink">Diagonal swipe</span> — drag diagonally
              across the board to open official DBE past papers for practice.
            </p>
          </li>
          <li className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-gold-deep" aria-hidden="true" />
            <p>
              Buttons for both actions are always on screen — gestures are a shortcut, never a
              requirement.
            </p>
          </li>
        </ul>
        <button type="button" onClick={onDismiss} className="btn-gold mt-6 w-full py-2.5 text-sm">
          Got it
        </button>
      </div>
    </div>
  );
}

/** Arrow fallbacks for tutor switching (desktop / no-gesture users). */
export function TutorSwitchButtons({
  onSwitch,
  disabled,
}: {
  onSwitch: (direction: 1 | -1) => void;
  disabled: boolean;
}) {
  if (disabled) return null;
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Switch tutor">
      <button
        type="button"
        onClick={() => onSwitch(-1)}
        className="btn-ghost flex items-center gap-1 px-2.5 py-1.5 text-xs"
        title="Previous tutor (or bowl-swipe left on the board)"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Prev tutor
      </button>
      <button
        type="button"
        onClick={() => onSwitch(1)}
        className="btn-ghost flex items-center gap-1 px-2.5 py-1.5 text-xs"
        title="Next tutor (or bowl-swipe right on the board)"
      >
        Next tutor <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
