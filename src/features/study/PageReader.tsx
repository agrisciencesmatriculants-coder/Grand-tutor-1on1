import { memo, useCallback, useEffect, useState, type FormEvent } from 'react';
import { BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/language';
import type { FileRow } from '../../lib/types';
import MarkdownBlock from './MarkdownBlock';

interface QA {
  question: string;
  answer: string;
}

/** Per-file reader state, kept locally so switching files resumes where you left off. */
interface FileReaderState {
  page: number;
  totalPages: number | null;
  explanations: Record<number, string>;
  qa: QA[];
}

const EMPTY_STATE: FileReaderState = { page: 1, totalPages: null, explanations: {}, qa: [] };

async function invokeErrorMessage(error: unknown): Promise<string> {
  const err = error as { message?: string; context?: Response } | null;
  if (err?.context && typeof err.context.json === 'function') {
    try {
      const body = (await err.context.json()) as { error?: string };
      if (body && typeof body.error === 'string') return body.error;
    } catch {
      /* fall through */
    }
  }
  return err?.message ?? 'Agron could not read that page right now. Please try again.';
}

/**
 * Question box with LOCAL state (contract §13): typing here never re-renders
 * the page navigator, explanation or Q&A history — only this small form.
 */
const AskAgronForm = memo(function AskAgronForm({
  disabled,
  asking,
  onAsk,
}: {
  disabled: boolean;
  asking: boolean;
  onAsk: (question: string) => void;
}) {
  const [question, setQuestion] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || disabled || asking) return;
    onAsk(q);
    setQuestion('');
  }

  return (
    <form onSubmit={submit} className="mt-5 border-t border-sand pt-4">
      <label className="block">
        <span className="font-label mb-1 block text-[10px] text-ink-soft">
          Ask Agron about this page
        </span>
        <textarea
          className="input-stage min-h-[4rem] resize-y"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Why does the farmer rotate crops on this page?"
          maxLength={600}
          disabled={disabled || asking}
        />
      </label>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          className="btn-gold px-4 py-1.5 text-xs"
          disabled={disabled || asking || !question.trim()}
        >
          {asking ? 'Agron is thinking…' : 'Ask Agron'}
        </button>
        {asking && (
          <span className="flex items-center gap-2 text-xs text-gold-deep" role="status">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gold/25 border-t-gold" />
            Reading this page closely…
          </span>
        )}
      </div>
    </form>
  );
});

/**
 * "Page-by-page with Agron" — walks a text-extracted file through the
 * study-tools `page_by_page` mode (contract §3): ~1200-char pages, a
 * learner-friendly explanation per page, and a question box per page.
 * The current UI language is sent with every invoke (contract §15).
 */
export default function PageReader() {
  const { lang } = useLanguage();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState('');

  const [states, setStates] = useState<Record<string, FileReaderState>>({});
  const [loadingPage, setLoadingPage] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setFilesLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('files')
        .select('id, file_name, file_type, subject, extracted_text, created_at')
        .not('extracted_text', 'is', null)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (err) {
        setFilesError(err.message);
      } else {
        const ready = ((data ?? []) as FileRow[]).filter((f) => f.extracted_text?.trim());
        setFiles(ready);
        setSelectedFileId(ready[0]?.id ?? '');
      }
      setFilesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const readerState = states[selectedFileId] ?? EMPTY_STATE;
  const explanation = readerState.explanations[readerState.page] ?? null;

  const patchState = useCallback((fileId: string, patch: Partial<FileReaderState>) => {
    setStates((prev) => ({
      ...prev,
      [fileId]: { ...(prev[fileId] ?? EMPTY_STATE), ...patch },
    }));
  }, []);

  const fetchPage = useCallback(
    async (fileId: string, page: number) => {
      if (!supabase) return;
      setError(null);
      setLoadingPage(true);
      try {
        const { data, error: err } = await supabase.functions.invoke('study-tools', {
          body: { mode: 'page_by_page', fileId, page, language: lang },
        });
        if (err) throw err;
        if (data && typeof data.error === 'string') throw new Error(data.error);
        if (typeof data?.explanation !== 'string') {
          throw new Error('Agron replied in an unexpected format. Please try again.');
        }
        const current = states[fileId] ?? EMPTY_STATE;
        patchState(fileId, {
          page: data.page ?? page,
          totalPages: data.totalPages ?? current.totalPages,
          explanations: { ...current.explanations, [data.page ?? page]: data.explanation },
        });
      } catch (err) {
        setError(await invokeErrorMessage(err));
      } finally {
        setLoadingPage(false);
      }
    },
    [patchState, states, lang],
  );

  // Kick off page 1 when a file with no local state is selected.
  useEffect(() => {
    if (!selectedFileId || !supabase) return;
    if (!states[selectedFileId]) {
      void fetchPage(selectedFileId, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFileId]);

  function goToPage(nextPage: number) {
    if (!selectedFileId || loadingPage || asking) return;
    const total = readerState.totalPages;
    const target = Math.max(1, total ? Math.min(nextPage, total) : nextPage);
    if (target === readerState.page) return;
    if (readerState.explanations[target]) {
      patchState(selectedFileId, { page: target });
    } else {
      void fetchPage(selectedFileId, target);
    }
  }

  /** Called by AskAgronForm with a trimmed question (its text state stays local). */
  const askAgron = useCallback(
    async (q: string) => {
      if (!supabase || !selectedFileId || asking || loadingPage) return;
      setError(null);
      setAsking(true);
      try {
        const page = (states[selectedFileId] ?? EMPTY_STATE).page;
        const { data, error: err } = await supabase.functions.invoke('study-tools', {
          body: { mode: 'page_by_page', fileId: selectedFileId, page, question: q, language: lang },
        });
        if (err) throw err;
        if (data && typeof data.error === 'string') throw new Error(data.error);
        if (typeof data?.explanation !== 'string') {
          throw new Error('Agron replied in an unexpected format. Please try again.');
        }
        patchState(selectedFileId, {
          qa: [...(states[selectedFileId] ?? EMPTY_STATE).qa, { question: q, answer: data.explanation }],
        });
      } catch (err) {
        setError(await invokeErrorMessage(err));
      } finally {
        setAsking(false);
      }
    },
    [selectedFileId, asking, loadingPage, states, patchState, lang],
  );

  if (filesLoading) {
    return <p className="text-sm text-ink-soft">Loading files…</p>;
  }
  if (filesError) {
    return (
      <p role="alert" className="text-sm text-terra-deep">
        {filesError}
      </p>
    );
  }
  if (files.length === 0) {
    return (
      <div className="card-playbill border-dashed p-6 text-center">
        <BookOpen className="mx-auto h-8 w-8 text-gold" aria-hidden="true" />
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          No documents are ready for guided reading yet. Upload a study document in the Classroom
          and wait for its text to be extracted; Agron can then explain it page by page.
        </p>
      </div>
    );
  }

  const selectedFile = files.find((f) => f.id === selectedFileId) ?? null;
  const totalPages = readerState.totalPages;

  return (
    <div className="space-y-5">
      {/* File picker */}
      <section className="card-playbill p-5 sm:p-6" aria-label="Choose a file to read">
        <p className="font-label text-[10px] text-gold-deep">Guided reading</p>
        <h2 className="font-display mt-1 text-lg font-bold text-ink">
          Work through the document one page at a time
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Agron explains each page in clear language and answers questions as they come up.
        </p>
        <label className="mt-3 block">
          <span className="sr-only">Document to read</span>
          <select
            className="input-stage"
            value={selectedFileId}
            onChange={(e) => setSelectedFileId(e.target.value)}
          >
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.file_name ?? 'Untitled file'}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Reader */}
      {selectedFile && (
        <section
          className="card-playbill relative overflow-hidden p-5 sm:p-6"
          aria-label="Page-by-page reader"
        >
          <div className="spotlight" />
          <div className="relative">
            {/* Page navigator */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => goToPage(readerState.page - 1)}
                disabled={loadingPage || asking || readerState.page <= 1}
              >
                ← Previous page
              </button>
              <span className="font-label text-xs text-gold-deep">
                Page {readerState.page}
                {totalPages ? ` of ${totalPages}` : ''}
              </span>
              <button
                type="button"
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => goToPage(readerState.page + 1)}
                disabled={loadingPage || asking || (totalPages !== null && readerState.page >= totalPages)}
              >
                Next page →
              </button>
              <span className="ml-auto max-w-full truncate text-xs text-ink-soft">
                {selectedFile.file_name}
              </span>
            </div>

            {/* Explanation (markdown render memoized — contract §13) */}
            <div className="mt-4 min-h-[6rem]">
              {loadingPage && !explanation ? (
                <p className="flex items-center gap-2 text-sm text-gold-deep" role="status">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold/25 border-t-gold" />
                  Agron is reading page {readerState.page}…
                </p>
              ) : explanation ? (
                <>
                  {loadingPage && (
                    <p className="mb-2 flex items-center gap-2 text-xs text-gold-deep" role="status">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gold/25 border-t-gold" />
                      Agron is turning the page…
                    </p>
                  )}
                  <MarkdownBlock markdown={explanation} />
                </>
              ) : (
                <p className="text-sm text-ink-soft">Choose a page to begin the walkthrough.</p>
              )}
            </div>

            {error && (
              <p role="alert" className="mt-3 text-sm text-terra-deep">
                {error}
              </p>
            )}

            {/* Q&A history on this document */}
            {readerState.qa.length > 0 && (
              <div className="mt-5 space-y-3 border-t border-sand pt-4">
                <p className="font-label text-[10px] text-gold-deep">
                  Questions about this document
                </p>
                {readerState.qa.map((item, i) => (
                  <div key={i} className="rounded-lg border border-sand bg-ivory-deep p-4">
                    <p className="text-sm font-semibold text-ink">Question: {item.question}</p>
                    <MarkdownBlock
                      markdown={item.answer}
                      className="mt-2 border-l-2 border-gold/40 pl-3"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Ask box — local state, isolated re-renders (contract §13) */}
            <AskAgronForm disabled={loadingPage} asking={asking} onAsk={askAgron} />
          </div>
        </section>
      )}
    </div>
  );
}
