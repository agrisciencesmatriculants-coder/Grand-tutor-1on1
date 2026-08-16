import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shuffle } from 'lucide-react';
import type { Flashcard } from '../../lib/types';
import { cn } from '../../lib/utils';

export interface FlashcardDeckProps {
  cards: Flashcard[];
}

/**
 * 3D-flip flashcard deck styled like a playbill.
 * Prev/next + keyboard arrows (←/→), Space/Enter flips, progress "3 / 15",
 * shuffle button.
 */
export default function FlashcardDeck({ cards }: FlashcardDeckProps) {
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Reset when a new deck arrives.
  useEffect(() => {
    setOrder(cards.map((_, i) => i));
    setIndex(0);
    setFlipped(false);
  }, [cards]);

  const total = order.length;
  const card = total > 0 ? cards[order[index]] : null;

  const goPrev = useCallback(() => {
    setFlipped(false);
    setIndex((i) => (total ? (i - 1 + total) % total : 0));
  }, [total]);

  const goNext = useCallback(() => {
    setFlipped(false);
    setIndex((i) => (total ? (i + 1) % total : 0));
  }, [total]);

  const flip = useCallback(() => setFlipped((f) => !f), []);

  const shuffle = useCallback(() => {
    setOrder((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
    setIndex(0);
    setFlipped(false);
  }, []);

  // Keyboard arrows navigate; Space/Enter flips.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (target?.tagName === 'BUTTON') return; // let buttons handle their own keys
        e.preventDefault();
        flip();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, flip]);

  const flipTransform = useMemo(
    () => (flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'),
    [flipped],
  );

  if (!card) {
    return <p className="text-sm text-cream-dim">No flashcards in this deck yet.</p>;
  }

  return (
    <div className="space-y-4">
      {/* 3D flip card */}
      <div
        className="mx-auto w-full max-w-xl cursor-pointer select-none"
        style={{ perspective: '1200px' }}
        onClick={flip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            flip();
          }
        }}
        aria-label={flipped ? 'Flashcard back — click to see the front' : 'Flashcard front — click to flip'}
      >
        <div
          className="relative h-64 w-full transition-transform duration-500 sm:h-72"
          style={{ transformStyle: 'preserve-3d', transform: flipTransform }}
        >
          {/* Front — the playbill cover */}
          <div
            className="card-playbill absolute inset-0 flex flex-col items-center justify-center overflow-hidden p-6 text-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="spotlight" />
            <p className="font-label relative text-[9px] text-gold-dim">Playbill · Front of card</p>
            <p className="font-display relative mt-3 text-xl font-bold leading-snug text-cream sm:text-2xl">
              {card.front}
            </p>
            <p className="font-label relative mt-4 text-[9px] text-cream-dim/60">
              Click or press Space to reveal
            </p>
          </div>
          {/* Back — the answer */}
          <div
            className="card-playbill absolute inset-0 flex flex-col items-center justify-center overflow-hidden border-gold/50 p-6 text-center"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="spotlight" />
            <p className="font-label relative text-[9px] text-gold-dim">The reveal</p>
            <p className="relative mt-3 text-base leading-relaxed text-gold-light sm:text-lg">
              {card.back}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={goPrev}>
          ← Prev
        </button>
        <span className="font-label min-w-[4.5rem] text-center text-xs text-gold-light">
          {index + 1} / {total}
        </span>
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={goNext}>
          Next →
        </button>
        <button
          type="button"
          className={cn('btn-ghost px-3 py-1.5 text-xs')}
          onClick={shuffle}
          title="Shuffle the deck"
        >
          <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
          Shuffle
        </button>
      </div>
      <p className="text-center font-label text-[9px] text-cream-dim/60">
        ← → to move · Space to flip
      </p>
    </div>
  );
}
