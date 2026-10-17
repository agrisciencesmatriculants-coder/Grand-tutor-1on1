import { useCallback, useEffect, useState } from 'react';
import { Check, CircleHelp, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import type { Quiz, QuizQuestionPublic } from '../../lib/types';

interface DraftQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

interface AiDraft {
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
}

const EMPTY_DRAFT: DraftQuestion = { question: '', options: ['', '', '', ''], correctIndex: 0 };

/**
 * Quiz builder (teacher): create/edit the quiz attached to a telegraph script.
 * Questions are written with correct_index — the column is never readable
 * back to any client (quiz_vp.sql column grants), so answers stay server-side.
 */
export default function QuizBuilder({
  scriptId,
  scriptTitle,
  onClose,
}: {
  scriptId: string;
  scriptTitle: string;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionPublic[]>([]);
  const [draft, setDraft] = useState<DraftQuestion>(EMPTY_DRAFT);
  const [title, setTitle] = useState(`${scriptTitle} — quiz`);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // AI drafting (tutor-assist edge function)
  const [aiTopic, setAiTopic] = useState(scriptTitle);
  const [aiDrafts, setAiDrafts] = useState<AiDraft[]>([]);
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !profile) return;
    setLoading(true);
    const { data: q } = await supabase
      .from('quizzes')
      .select('*')
      .eq('script_id', scriptId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (q) {
      const quizRow = q as Quiz;
      setQuiz(quizRow);
      setTitle(quizRow.title);
      const { data: qs } = await supabase
        .from('quiz_questions')
        .select('id, quiz_id, question, options, position, created_at')
        .eq('quiz_id', quizRow.id)
        .order('position', { ascending: true });
      setQuestions((qs ?? []) as QuizQuestionPublic[]);
    }
    setLoading(false);
  }, [profile, scriptId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addQuestion = useCallback(async () => {
    if (!supabase || !profile) return;
    setError(null);
    setNotice(null);
    const question = draft.question.trim();
    const options = draft.options.map((o) => o.trim()).filter(Boolean);
    if (!question || options.length < 2) {
      setError('Enter a question and at least two answer options.');
      return;
    }
    if (draft.correctIndex >= options.length) {
      setError('The correct answer must be one of the filled-in options.');
      return;
    }
    setSaving(true);
    try {
      let quizId = quiz?.id;
      if (!quizId) {
        const { data: created, error: cErr } = await supabase
          .from('quizzes')
          .insert({ script_id: scriptId, tutor_id: profile.id, title: title.trim() || 'Quiz' })
          .select('*')
          .single();
        if (cErr || !created) throw new Error(cErr?.message ?? 'Failed to create the quiz.');
        quizId = (created as Quiz).id;
        setQuiz(created as Quiz);
      }
      const { error: qErr } = await supabase.from('quiz_questions').insert({
        quiz_id: quizId,
        question,
        options,
        correct_index: draft.correctIndex,
        position: questions.length,
      });
      if (qErr) throw new Error(qErr.message);
      setDraft(EMPTY_DRAFT);
      setNotice('Question added. The correct answer is stored server-side only.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add the question.');
    } finally {
      setSaving(false);
    }
  }, [draft, load, profile, questions.length, quiz?.id, scriptId, title]);

  const removeQuestion = useCallback(
    async (id: string) => {
      if (!supabase) return;
      await supabase.from('quiz_questions').delete().eq('id', id);
      await load();
    },
    [load],
  );

  /** Ensure the quiz row exists; returns its id. */
  const ensureQuiz = useCallback(async (): Promise<string | null> => {
    if (!supabase || !profile) return null;
    if (quiz?.id) return quiz.id;
    const { data: created, error: cErr } = await supabase
      .from('quizzes')
      .insert({ script_id: scriptId, tutor_id: profile.id, title: title.trim() || 'Quiz' })
      .select('*')
      .single();
    if (cErr || !created) {
      setError(cErr?.message ?? 'Failed to create the quiz.');
      return null;
    }
    setQuiz(created as Quiz);
    return (created as Quiz).id;
  }, [profile, quiz?.id, scriptId, title]);

  /** Draft quiz questions with the AI assistant. */
  const draftWithAi = useCallback(async () => {
    if (!supabase || !aiTopic.trim() || aiBusy) return;
    setAiBusy(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('tutor-assist', {
        body: { mode: 'quiz', topic: aiTopic.trim(), count: 5 },
      });
      if (fnErr) throw new Error(fnErr.message ?? 'AI request failed.');
      if (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)) {
        throw new Error(String((data as Record<string, unknown>).error));
      }
      const items = (data as { items?: unknown }).items;
      const drafts = (Array.isArray(items) ? items : []) as AiDraft[];
      setAiDrafts(
        drafts.filter(
          (d) =>
            typeof d.question === 'string' &&
            Array.isArray(d.options) &&
            d.options.length >= 2 &&
            typeof d.correct_index === 'number' &&
            d.correct_index >= 0 &&
            d.correct_index < d.options.length,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI request failed.');
    } finally {
      setAiBusy(false);
    }
  }, [aiBusy, aiTopic]);

  /** Save all AI-drafted questions to the quiz. */
  const addAllDrafts = useCallback(async () => {
    if (!supabase || aiDrafts.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const quizId = await ensureQuiz();
      if (!quizId) return;
      const rows = aiDrafts.map((d, i) => ({
        quiz_id: quizId,
        question: d.question.trim(),
        options: d.options.map((o) => String(o).trim()).filter(Boolean),
        correct_index: d.correct_index,
        position: questions.length + i,
      }));
      const { error: insErr } = await supabase.from('quiz_questions').insert(rows);
      if (insErr) throw new Error(insErr.message);
      setNotice(`${rows.length} AI-drafted questions added. Review them — you can delete any below.`);
      setAiDrafts([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add the questions.');
    } finally {
      setSaving(false);
    }
  }, [aiDrafts, ensureQuiz, load, questions.length]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true">
      <div className="card-playbill max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display flex items-center gap-2 text-lg font-semibold text-ink">
              <CircleHelp className="h-5 w-5 text-gold-deep" aria-hidden="true" />
              Quiz builder
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              Attached to “{scriptTitle}”. Answers are scored on the server — students can never see
              the correct options.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close quiz builder" className="text-ink-soft hover:text-ink">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-ink-soft">Loading…</p>
        ) : (
          <div className="mt-4 space-y-5">
            <label className="block text-sm font-medium text-ink">
              Quiz title
              <input
                className="input-stage mt-1 w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            {questions.length > 0 && (
              <ol className="space-y-2">
                {questions.map((q, i) => (
                  <li key={q.id} className="flex items-start gap-2 rounded-md border border-sand bg-ivory/60 p-3">
                    <span className="font-mono text-xs text-ink-soft">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{q.question}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">{q.options.length} options</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeQuestion(q.id)}
                      aria-label="Delete question"
                      className="text-ink-soft hover:text-terracotta"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {/* AI drafting */}
            <div className="space-y-3 rounded-md border border-gold/40 bg-gold-tint/40 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Sparkles className="h-4 w-4 text-gold-deep" aria-hidden="true" />
                Draft with the AI assistant
              </h3>
              <div className="flex flex-wrap gap-2">
                <input
                  className="input-stage min-w-[12rem] flex-1"
                  placeholder="Topic to draft questions on"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                />
                <button
                  type="button"
                  disabled={aiBusy || !aiTopic.trim()}
                  onClick={() => void draftWithAi()}
                  className="btn-gold px-4 py-2 text-sm disabled:opacity-60"
                >
                  {aiBusy ? 'Drafting…' : 'Draft 5 questions'}
                </button>
              </div>
              {aiDrafts.length > 0 && (
                <>
                  <ol className="space-y-2">
                    {aiDrafts.map((d, i) => (
                      <li key={i} className="rounded-md border border-sand bg-paper p-3">
                        <p className="text-sm font-medium text-ink">{d.question}</p>
                        <ul className="mt-1 space-y-0.5">
                          {d.options.map((o, oi) => (
                            <li
                              key={oi}
                              className={
                                oi === d.correct_index
                                  ? 'flex items-center gap-1 text-xs font-semibold text-sage-deep'
                                  : 'text-xs text-ink-soft'
                              }
                            >
                              {oi === d.correct_index ? (
                                <Check className="h-3 w-3" aria-label="Correct answer" />
                              ) : (
                                <span aria-hidden="true">·</span>
                              )}
                              {o}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void addAllDrafts()}
                      className="btn-gold px-4 py-2 text-sm disabled:opacity-60"
                    >
                      {saving ? 'Saving…' : `Add all ${aiDrafts.length} to the quiz`}
                    </button>
                    <button type="button" onClick={() => setAiDrafts([])} className="btn-ghost px-3 py-2 text-sm">
                      Discard draft
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3 rounded-md border border-sand p-4">
              <h3 className="text-sm font-semibold text-ink">Add a question manually</h3>
              <textarea
                className="input-stage w-full"
                rows={2}
                placeholder="Question text"
                value={draft.question}
                onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
              />
              {draft.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-option"
                    title="Mark as the correct answer"
                    checked={draft.correctIndex === i}
                    onChange={() => setDraft((d) => ({ ...d, correctIndex: i }))}
                    className="accent-gold"
                  />
                  <input
                    className="input-stage flex-1"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) =>
                      setDraft((d) => {
                        const options = [...d.options];
                        options[i] = e.target.value;
                        return { ...d, options };
                      })
                    }
                  />
                </div>
              ))}
              <p className="text-xs text-ink-soft">Select the radio button next to the correct answer.</p>

              {error && <p className="text-sm text-terracotta" role="alert">{error}</p>}
              {notice && <p className="text-sm text-sage" role="status">{notice}</p>}

              <button
                type="button"
                disabled={saving}
                onClick={() => void addQuestion()}
                className="btn-gold flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {saving ? 'Saving…' : 'Add question'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
