import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Award, CheckCircle2, CircleHelp, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Quiz, QuizQuestionPublic } from '../lib/types';
import { cn } from '../lib/utils';

interface ScoreResult {
  score_pct: number;
  correct: number;
  total: number;
  vp_awarded: number;
  duplicate?: boolean;
  screening?: { passed: boolean };
}

/**
 * Cheat-proof quiz (Phase 2): the client only ever sees question text +
 * options. Answers are scored by the score-quiz edge function; VP goes to
 * the tutor. An idempotency key makes retries safe.
 */
export default function TakeQuiz() {
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();
  const isScreening = searchParams.get('screening') === '1';
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionPublic[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);

  useEffect(() => {
    if (!supabase || !quizId) return;
    let cancelled = false;
    async function load() {
      const { data: q, error: qErr } = await supabase!
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .maybeSingle();
      if (qErr || !q) {
        if (!cancelled) {
          setError('Quiz not found.');
          setLoading(false);
        }
        return;
      }
      const { data: qs } = await supabase!
        .from('quiz_questions')
        // Explicit columns — correct_index is not granted to clients.
        .select('id, quiz_id, question, options, position, created_at')
        .eq('quiz_id', quizId)
        .order('position', { ascending: true });
      if (cancelled) return;
      setQuiz(q as Quiz);
      setQuestions((qs ?? []) as QuizQuestionPublic[]);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  const allAnswered = questions.length > 0 && questions.every((_, i) => answers[i] !== undefined);

  const submit = useCallback(async () => {
    if (!supabase || !quizId || !allAnswered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const ordered = questions.map((_, i) => answers[i]);
      const { data, error: fnErr } = await supabase.functions.invoke('score-quiz', {
        body: { quiz_id: quizId, answers: ordered, idempotency_key: crypto.randomUUID() },
      });
      if (fnErr) {
        const msg =
          typeof fnErr === 'object' && fnErr && 'message' in fnErr
            ? String((fnErr as { message?: string }).message)
            : 'Scoring failed. Please try again.';
        throw new Error(msg);
      }
      if (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)) {
        throw new Error(String((data as Record<string, unknown>).error));
      }
      setResult(data as ScoreResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scoring failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [allAnswered, answers, questions, quizId, submitting]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/tv" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to VukaTV
      </Link>

      <header>
        <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-ink">
          <CircleHelp className="h-6 w-6 text-gold-deep" aria-hidden="true" />
          {quiz?.title ?? 'Quiz'}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Your score earns Vuka Points for the tutor. Only improvement over your previous best
          counts, so take your time and answer honestly.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-soft">Loading the quiz…</p>
      ) : result ? (
        <div className="card-playbill p-8 text-center">
          <Award className="mx-auto h-10 w-10 text-gold-deep" aria-hidden="true" />
          <p className="font-display mt-3 text-3xl font-bold text-ink">{result.score_pct}%</p>
          <p className="mt-1 text-sm text-ink-soft">
            {result.correct} of {result.total} correct
          </p>
          {isScreening ? (
            <p className="mt-3 text-sm text-ink">
              {result.score_pct >= 70 ? (
                <>
                  <span className="font-semibold text-sage-deep">Passed.</span> Your result was recorded on
                  your tutor application.
                </>
              ) : (
                <>
                  <span className="font-semibold text-terra-deep">Below the 70% pass mark.</span> You can
                  retake the test from your application page.
                </>
              )}
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink">
              {result.vp_awarded > 0 ? (
                <>
                  You earned the tutor <span className="font-semibold text-gold-deep">{result.vp_awarded} VP</span>.
                </>
              ) : (
                'No new VP this time — only improvement over your previous best earns points.'
              )}
            </p>
          )}
          {result.duplicate && (
            <p className="mt-1 text-xs text-ink-soft">This attempt was already recorded.</p>
          )}
          <Link
            to={isScreening ? '/apply' : '/tv'}
            className="btn-gold mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {isScreening ? 'Back to my application' : 'Done'}
          </Link>
        </div>
      ) : questions.length === 0 ? (
        <div className="card-playbill p-8 text-center">
          <p className="text-sm text-ink-soft">This quiz has no questions yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <fieldset key={q.id} className="card-playbill p-4 sm:p-5">
              <legend className="sr-only">Question {qi + 1}</legend>
              <p className="text-sm font-medium text-ink">
                <span className="mr-1.5 font-mono text-xs text-ink-soft">{qi + 1}.</span>
                {q.question}
              </p>
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => (
                  <label
                    key={oi}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition',
                      answers[qi] === oi
                        ? 'border-gold bg-gold/10 text-ink'
                        : 'border-sand bg-paper text-ink-soft hover:bg-gold/5',
                    )}
                  >
                    <input
                      type="radio"
                      name={`q-${qi}`}
                      checked={answers[qi] === oi}
                      onChange={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                      className="accent-gold"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={!allAnswered || submitting}
            onClick={() => void submit()}
            className="btn-gold flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {submitting ? 'Scoring on the server…' : 'Submit answers'}
          </button>
          {!allAnswered && (
            <p className="text-xs text-ink-soft">Answer every question to submit.</p>
          )}
        </div>
      )}
    </div>
  );
}
