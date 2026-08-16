import { useEffect, useMemo, useState } from 'react';
import { Check, Clapperboard, Drama, RotateCcw, X } from 'lucide-react';
import type { QuizQuestion } from '../../lib/types';
import { cn } from '../../lib/utils';

export interface QuizRunnerProps {
  quiz: { questions: QuizQuestion[] };
}

/** Encouraging theatrical tier by score fraction. */
function resultTier(fraction: number): { title: string; message: string } {
  if (fraction >= 0.9) {
    return {
      title: 'Standing ovation!',
      message:
        'A flawless command of the material, Kelebogile — the NSC examiners will be on their feet. Bravo, encore!',
    };
  }
  if (fraction >= 0.7) {
    return {
      title: 'Bravo, encore!',
      message:
        'A commanding performance. Polish the few missed lines and opening night (exam day) is yours.',
    };
  }
  if (fraction >= 0.5) {
    return {
      title: 'A solid rehearsal!',
      message:
        'The bones of the piece are there. Run the flashcards once more and this will shine under the spotlight.',
    };
  }
  return {
    title: 'The dress rehearsal continues',
    message:
      'Every great actor flubs lines before opening night. Read the explanations, rehearse again — you are getting there.',
  };
}

/**
 * One-question-at-a-time NSC quiz. Selecting an option immediately colours
 * right (gold) / wrong (crimson) and shows the explanation. Ends with a
 * results screen and retry.
 */
export default function QuizRunner({ quiz }: QuizRunnerProps) {
  const questions = useMemo(() => quiz.questions ?? [], [quiz]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  // Reset when a new quiz arrives.
  useEffect(() => {
    setIndex(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  }, [quiz]);

  if (questions.length === 0) {
    return <p className="text-sm text-cream-dim">This quiz has no questions yet.</p>;
  }

  if (finished) {
    const tier = resultTier(score / questions.length);
    return (
      <div className="card-playbill relative mx-auto max-w-xl overflow-hidden p-8 text-center">
        <div className="spotlight" />
        <div className="relative">
          {score / questions.length >= 0.7 ? (
            <Drama className="mx-auto h-10 w-10 text-gold" aria-hidden="true" />
          ) : (
            <Clapperboard className="mx-auto h-10 w-10 text-gold" aria-hidden="true" />
          )}
          <p className="font-label mt-3 text-[10px] text-gold-dim">Final curtain</p>
          <h3 className="font-display mt-1 text-2xl font-bold text-gold-light">{tier.title}</h3>
          <p className="font-display mt-3 text-4xl font-bold text-cream">
            {score}
            <span className="text-xl text-cream-dim"> / {questions.length}</span>
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-cream-dim">{tier.message}</p>
          <button
            type="button"
            className="btn-gold mt-6"
            onClick={() => {
              setIndex(0);
              setPicked(null);
              setScore(0);
              setFinished(false);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Run it again
          </button>
        </div>
      </div>
    );
  }

  const q = questions[index];
  const answered = picked !== null;
  const isCorrect = answered && picked === q.answer;

  function pick(option: string) {
    if (answered) return;
    setPicked(option);
    if (option === q.answer) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= questions.length) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
      setPicked(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="font-label text-[10px] text-cream-dim">
          Scene {index + 1} of {questions.length}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stage-deep">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-dim to-gold transition-all"
            style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
        <span className="font-label text-[10px] text-gold-light">Score {score}</span>
      </div>

      {/* Question */}
      <div className="card-playbill p-5 sm:p-6">
        <h3 className="font-display text-lg font-bold leading-snug text-cream">{q.q}</h3>

        <ul className="mt-4 space-y-2">
          {q.options.map((option, i) => {
            const isAnswer = option === q.answer;
            const isPicked = option === picked;
            return (
              <li key={`${index}-${i}`}>
                <button
                  type="button"
                  onClick={() => pick(option)}
                  disabled={answered}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition',
                    !answered &&
                      'border-gold/20 bg-stage-deep/60 text-cream hover:border-gold/50 hover:bg-gold/10',
                    answered && isAnswer &&
                      'border-gold bg-gold/20 text-gold-light shadow-[0_0_18px_rgba(232,179,75,0.25)]',
                    answered && isPicked && !isAnswer &&
                      'border-crimson-light bg-crimson/20 text-crimson-light',
                    answered && !isPicked && !isAnswer &&
                      'border-gold/10 bg-stage-deep/40 text-cream-dim/60',
                  )}
                >
                  <span
                    className={cn(
                      'font-label flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px]',
                      answered && isAnswer
                        ? 'border-gold text-gold-light'
                        : answered && isPicked && !isAnswer
                          ? 'border-crimson-light text-crimson-light'
                          : 'border-gold/30 text-cream-dim',
                    )}
                  >
                    {answered && isAnswer ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : answered && isPicked ? (
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      String.fromCharCode(65 + i)
                    )}
                  </span>
                  <span>{option}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Immediate feedback + explanation */}
        {answered && (
          <div
            className={cn(
              'mt-4 rounded-lg border p-4',
              isCorrect ? 'border-gold/40 bg-gold/10' : 'border-crimson/50 bg-crimson/10',
            )}
            role="status"
          >
            <p
              className={cn(
                'font-label text-[10px]',
                isCorrect ? 'text-gold-light' : 'text-crimson-light',
              )}
            >
              {isCorrect ? (
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Correct — take a bow
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <X className="h-3 w-3" aria-hidden="true" />
                  Not quite — the answer is “{q.answer}”
                </span>
              )}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-cream">{q.explanation}</p>
            <div className="mt-3 text-right">
              <button type="button" className="btn-gold px-4 py-1.5 text-xs" onClick={next}>
                {index + 1 >= questions.length ? 'See the final results →' : 'Next question →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
