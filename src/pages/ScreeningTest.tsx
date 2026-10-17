import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Loader2, Send, Timer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ScreeningTestSafe } from '../lib/types';
import { cn } from '../lib/utils';

const MIN_WORDS = 100;
const MAX_WORDS = 200;

function words(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function useCountdown(expiresAt: string | null): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  return left;
}

/**
 * 30-mark prove-your-subject paper: 10 long-form questions (2 marks each)
 * + one 100–200 word subject overview (10 marks). Written twice per subject.
 * The tutor never sees the result — the CEO dashboard does.
 */
export default function ScreeningTest() {
  const { testId } = useParams<{ testId: string }>();
  const [test, setTest] = useState<ScreeningTestSafe | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [overview, setOverview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState(false);
  const secondsLeft = useCountdown(test?.expires_at ?? null);
  const timeUp = secondsLeft !== null && secondsLeft <= 0;

  const load = useCallback(async () => {
    if (!supabase || !testId) return;
    const { data } = await supabase
      .from('my_screening_tests')
      .select('*')
      .eq('id', testId)
      .maybeSingle();
    const t = (data as ScreeningTestSafe | null) ?? null;
    if (!t || t.status !== 'in_progress') {
      setMissing(true);
    } else {
      setTest(t);
      setAnswers(t.questions.map(() => ''));
    }
    setLoading(false);
  }, [testId]);

  useEffect(() => {
    void load();
  }, [load]);

  const overviewWords = useMemo(() => words(overview), [overview]);
  const overviewOk = overviewWords >= MIN_WORDS && overviewWords <= MAX_WORDS;
  const allAnswered = answers.length > 0 && answers.every((a) => a.trim().length >= 5);

  const submit = async () => {
    if (!supabase || !test || !allAnswered || !overviewOk) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.functions.invoke('screening-test', {
        body: { action: 'submit', test_id: test.id, answers, overview },
      });
      if (e) throw new Error(e.message);
      if (data?.error) throw new Error(data.error);
      setReceived(true);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-ink-soft">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (missing || !test) {
    return (
      <div className="mx-auto max-w-2xl card-playbill p-6">
        <h1 className="text-xl font-bold text-ink">This paper is no longer open</h1>
        <p className="mt-1 text-sm text-ink-soft">
          It may already have been submitted. Start a new attempt from your application page.
        </p>
        <Link to="/apply" className="btn-gold mt-4 inline-block">Back to my application</Link>
      </div>
    );
  }

  if (received) {
    return (
      <div className="mx-auto max-w-2xl card-playbill p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-gold" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-bold text-ink">Your responses have been received</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Attempt {test.attempt_no} of 2 for <strong>{test.subject}</strong> is with our examiners.
          {test.attempt_no === 1
            ? ' Every tutor writes two papers — your second paper is ready whenever you are.'
            : ' Both of your papers are now complete.'}{' '}
          The review team looks at your papers together with your application.
        </p>
        <Link to="/apply" className="btn-gold mt-5 inline-block">Back to my application</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card-playbill p-6">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-0.5 h-6 w-6 shrink-0 text-gold" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-bold text-ink">
              {test.subject} <span className="font-normal text-ink-soft">· {test.level_label}</span>
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              Tutor screening paper — attempt {test.attempt_no} of 2. Ten written questions and one
              subject overview. Answer in your own words, as if explaining to a student.
            </p>
            {secondsLeft !== null && (
              <p
                className={cn(
                  'mt-2 flex items-center gap-1.5 text-sm font-semibold',
                  timeUp ? 'text-terra' : secondsLeft < 600 ? 'text-terra-deep' : 'text-ink-soft',
                )}
              >
                <Timer className="h-4 w-4" aria-hidden="true" />
                {timeUp
                  ? 'Time is up — this paper has closed.'
                  : `Time left: ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {timeUp && (
        <div className="border border-terra/40 bg-terra/5 px-4 py-3 text-sm text-terra">
          The 90 minutes for this paper are up. Start a fresh paper from your application page — the
          expired one does not count as an attempt.
        </div>
      )}

      {error && (
        <div className="border border-terra/40 bg-terra/5 px-4 py-3 text-sm text-terra" role="alert">{error}</div>
      )}

      {/* Long-form questions */}
      <ol className="space-y-4">
        {test.questions.map((q, i) => (
          <li key={i} className="card-playbill p-5">
            <label className="block" htmlFor={`q-${i}`}>
              <span className="text-sm font-semibold text-ink">Question {i + 1}</span>
              <span className="mt-1 block text-sm text-ink-soft">{q}</span>
            </label>
            <textarea
              id={`q-${i}`}
              className="input-stage mt-3 min-h-24 w-full"
              value={answers[i] ?? ''}
              onChange={(e) =>
                setAnswers((cur) => cur.map((a, j) => (j === i ? e.target.value : a)))
              }
              placeholder="Your answer (a short paragraph is enough)…"
            />
          </li>
        ))}
      </ol>

      {/* Overview */}
      <div className="card-playbill p-5">
        <label className="block" htmlFor="overview">
          <span className="text-sm font-semibold text-ink">Subject overview</span>
          <span className="mt-1 block text-sm text-ink-soft">
            Discuss this topic as an overview of the subject for a new student:{' '}
            <strong className="text-ink">{test.overview_topic}</strong>
          </span>
          <span className="mt-1 block text-xs text-ink-soft/80">
            Between {MIN_WORDS} and {MAX_WORDS} words.
          </span>
        </label>
        <textarea
          id="overview"
          className="input-stage mt-3 min-h-32 w-full"
          value={overview}
          onChange={(e) => setOverview(e.target.value)}
          placeholder="Write your overview here…"
        />
        <p
          className={cn(
            'mt-1 text-xs',
            overviewOk ? 'text-sage' : 'text-ink-soft/70',
          )}
        >
          {overviewWords}/{MIN_WORDS}–{MAX_WORDS} words
        </p>
      </div>

      <div className="flex items-center justify-between pb-4">
        <Link to="/apply" className="btn-ghost text-sm">Leave and resume later</Link>
        <button
          type="button"
          disabled={!allAnswered || !overviewOk || submitting || timeUp}
          onClick={() => void submit()}
          className="btn-gold flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          {submitting ? 'Submitting…' : 'Submit paper'}
        </button>
      </div>
    </div>
  );
}
