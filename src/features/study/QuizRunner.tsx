import { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, Check, RotateCcw, X } from 'lucide-react';
import type { QuizQuestion } from '../../lib/types';
import { cn } from '../../lib/utils';

export interface QuizRunnerProps {
  quiz: { questions: QuizQuestion[] };
}

/** Formal result tier by score fraction (contract §14). */
function resultTier(fraction: number): { title: string; message: string } {
  if (fraction >= 0.9) {
    return {
      title: 'Excellent result',
      message:
        'You have an excellent command of this material. Keep up this standard for the NSC examinations.',
    };
  }
  if (fraction >= 0.7) {
    return {
      title: 'Good progress',
      message:
        'A strong result. Review the questions you missed and you will be well prepared for the examination.',
    };
  }
  if (fraction >= 0.5) {
    return {
      title: 'Fair result — keep practising',
      message:
        'You understand the core ideas. Work through the flashcards once more and try the quiz again.',
    };
  }
  return {
    title: 'More revision needed',
    message:
      'Read the explanations carefully, revise the material, and try again. Steady practice will improve your score.',
  };
}

/**
 * One-question-at-a-time NSC quiz. Selecting an option immediately colours
 * right (gold) / wrong (terracotta) and shows the explanation. Ends with a
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
    return <p className="text-sm text-ink-soft">This quiz has no questions yet.</p>;
  }

  if (finished) {
    const tier = resultTier(score / questions.length);
    return (
      <div className="card-playbill relative mx-auto max-w-xl overflow-hidden p-8 text-center">
        <div className="spotlight" />
        <div className="relative">
          {score / questions.length >= 0.7 ? (
            <Award className="mx-auto h-10 w-10 text-gold" aria-hidden="true" />
          ) : (
            <BookOpen className="mx-auto h-10 w-10 text-gold" aria-hidden="true" />
          )}
          <p className="font-label mt-3 text-[10px] text-gold-deep">Quiz results</p>
          <h3 className="font-display mt-1 text-2xl font-bold text-ink">{tier.title}</h3>
          <p className="font-display mt-3 text-4xl font-bold text-ink">
            {score}
            <span className="text-xl text-ink-soft"> / {questions.length}</span>
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">{tier.message}</p>
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
            Try again
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
        <span className="font-label text-[10px] text-ink-soft">
          Question {index + 1} of {questions.length}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ivory-deep">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold transition-all"
            style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
        <span className="font-label text-[10px] text-gold-deep">Score {score}</span>
      </div>

      {/* Question */}
      <div className="card-playbill p-5 sm:p-6">
        <h3 className="font-display text-lg font-bold leading-snug text-ink">{q.q}</h3>

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
                      'border-sand bg-ivory-deep text-ink hover:border-gold/60 hover:bg-gold/10',
                    answered && isAnswer &&
                      'border-gold bg-gold/15 text-gold-deep shadow-[0_0_18px_rgba(201,153,46,0.25)]',
                    answered && isPicked && !isAnswer &&
                      'border-terra bg-terra-tint text-terra-deep',
                    answered && !isPicked && !isAnswer &&
                      'border-sand bg-ivory-deep/60 text-ink-soft/60',
                  )}
                >
                  <span
                    className={cn(
                      'font-label flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px]',
                      answered && isAnswer
                        ? 'border-gold text-gold-deep'
                        : answered && isPicked && !isAnswer
                          ? 'border-terra text-terra-deep'
                          : 'border-sand-deep text-ink-soft',
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
              isCorrect ? 'border-gold/50 bg-gold/10' : 'border-terra/50 bg-terra-tint',
            )}
            role="status"
          >
            <p
              className={cn(
                'font-label text-[10px]',
                isCorrect ? 'text-gold-deep' : 'text-terra-deep',
              )}
            >
              {isCorrect ? (
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Correct
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <X className="h-3 w-3" aria-hidden="true" />
                  Incorrect — the answer is “{q.answer}”
                </span>
              )}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink">{q.explanation}</p>
            <div className="mt-3 text-right">
              <button type="button" className="btn-gold px-4 py-1.5 text-xs" onClick={next}>
                {index + 1 >= questions.length ? 'View results' : 'Next question →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
