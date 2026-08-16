import { useCallback, useEffect, useState } from 'react';
import { Archive, Layers, ScrollText, Target, type LucideIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type {
  FileRow,
  Flashcard,
  QuizQuestion,
  StudyKind,
  StudyMaterial,
} from '../../lib/types';
import { cn, formatDateTime, truncate } from '../../lib/utils';
import FlashcardDeck from './FlashcardDeck';
import QuizRunner from './QuizRunner';
import { markdownClass, renderMarkdown } from './markdown';

type GeneratedResult =
  | { kind: 'notes'; markdown: string }
  | { kind: 'flashcards'; cards: Flashcard[] }
  | { kind: 'quiz'; quiz: { questions: QuizQuestion[] } };

const MODES: { kind: StudyKind; title: string; blurb: string; icon: LucideIcon }[] = [
  {
    kind: 'notes',
    title: 'Summary Notes',
    blurb: 'NSC-style summary notes with headings, definitions and exam tips.',
    icon: ScrollText,
  },
  {
    kind: 'flashcards',
    title: 'Flashcards',
    blurb: '15 flip-cards for fast revision — front asks, back reveals.',
    icon: Layers,
  },
  {
    kind: 'quiz',
    title: 'Practice Quiz',
    blurb: '10 NSC-style multiple-choice questions with explanations.',
    icon: Target,
  },
];

/** Pull the friendly {error} message out of a failed edge-function response. */
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
  return err?.message ?? 'Agron could not prepare that right now. Please try again.';
}

function isFlashcardArray(v: unknown): v is Flashcard[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      (c) =>
        c != null &&
        typeof c === 'object' &&
        typeof (c as Flashcard).front === 'string' &&
        typeof (c as Flashcard).back === 'string',
    )
  );
}

function isQuiz(v: unknown): v is { questions: QuizQuestion[] } {
  return (
    v != null &&
    typeof v === 'object' &&
    Array.isArray((v as { questions?: unknown }).questions) &&
    (v as { questions: unknown[] }).questions.length > 0
  );
}

/** Reopen a saved study_materials row as a renderable result. */
function resultFromMaterial(m: StudyMaterial): GeneratedResult | null {
  if (m.kind === 'notes') {
    const md = (m.content as { markdown?: unknown })?.markdown;
    if (typeof md === 'string') return { kind: 'notes', markdown: md };
  }
  if (m.kind === 'flashcards' && isFlashcardArray(m.content)) {
    return { kind: 'flashcards', cards: m.content };
  }
  if (m.kind === 'quiz' && isQuiz(m.content)) {
    return { kind: 'quiz', quiz: m.content };
  }
  return null;
}

const KIND_BADGE: Record<StudyKind, string> = {
  notes: 'Notes',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
};

const KIND_ICON: Record<StudyKind, LucideIcon> = {
  notes: ScrollText,
  flashcards: Layers,
  quiz: Target,
};

/** Small icon + label badge for a study-material kind. */
function KindBadge({ kind }: { kind: StudyKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {KIND_BADGE[kind]}
    </span>
  );
}

/**
 * Generate study materials from an uploaded file via the `study-tools` edge
 * function (contract §3), render results, and list previously generated
 * study_materials with click-to-reopen.
 */
export default function StudyGenerator() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string>('');

  const [busyMode, setBusyMode] = useState<StudyKind | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [resultTitle, setResultTitle] = useState<string>('');

  const [materials, setMaterials] = useState<StudyMaterial[]>([]);

  const loadFiles = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('files')
      .select('id, file_name, file_type, subject, extracted_text, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      setFilesError(error.message);
    } else {
      setFilesError(null);
      const rows = (data ?? []) as FileRow[];
      setFiles(rows);
      setSelectedFileId((prev) => {
        if (prev && rows.some((f) => f.id === prev)) return prev;
        return rows.find((f) => f.extracted_text?.trim())?.id ?? rows[0]?.id ?? '';
      });
    }
    setFilesLoading(false);
  }, []);

  const loadMaterials = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('study_materials')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (!error) setMaterials((data ?? []) as StudyMaterial[]);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setFilesLoading(false);
      return;
    }
    void loadFiles();
    void loadMaterials();
  }, [loadFiles, loadMaterials]);

  const selectedFile = files.find((f) => f.id === selectedFileId) ?? null;
  const selectedReady = Boolean(selectedFile?.extracted_text?.trim());

  async function generate(mode: StudyKind) {
    if (!supabase || busyMode) return;
    setGenError(null);
    if (!selectedFile) {
      setGenError('Pick a file from the vault first.');
      return;
    }
    if (!selectedReady) {
      setGenError(
        'This file is not Agron-ready yet — its text has not been extracted. Pick a file with the gold dot.',
      );
      return;
    }
    setBusyMode(mode);
    try {
      const { data, error } = await supabase.functions.invoke('study-tools', {
        body: { mode, fileId: selectedFile.id },
      });
      if (error) throw error;
      if (data && typeof data.error === 'string') throw new Error(data.error);

      if (mode === 'notes' && typeof data?.markdown === 'string') {
        setResult({ kind: 'notes', markdown: data.markdown });
      } else if (mode === 'flashcards' && isFlashcardArray(data?.flashcards)) {
        setResult({ kind: 'flashcards', cards: data.flashcards });
      } else if (mode === 'quiz' && isQuiz(data?.quiz)) {
        setResult({ kind: 'quiz', quiz: data.quiz });
      } else {
        throw new Error('Agron replied in an unexpected format. Please try again.');
      }
      setResultTitle(
        `${MODES.find((m) => m.kind === mode)?.title ?? mode} — ${selectedFile.file_name ?? 'file'}`,
      );
      void loadMaterials();
    } catch (err) {
      setGenError(await invokeErrorMessage(err));
    } finally {
      setBusyMode(null);
    }
  }

  function reopen(m: StudyMaterial) {
    setGenError(null);
    const reopened = resultFromMaterial(m);
    if (!reopened) {
      setGenError('That saved material could not be reopened (unexpected format).');
      return;
    }
    setResult(reopened);
    setResultTitle(m.title ?? KIND_BADGE[m.kind]);
  }

  return (
    <div className="space-y-6">
      {/* File picker */}
      <section className="card-playbill p-5 sm:p-6" aria-label="Choose a study file">
        <p className="font-label text-[10px] text-gold-dim">Step 1 · Choose the script</p>
        <h2 className="font-display mt-1 text-lg font-bold text-gold-light">
          Pick a file from the vault
        </h2>

        {filesLoading ? (
          <p className="mt-3 text-sm text-cream-dim">Opening the vault…</p>
        ) : filesError ? (
          <p role="alert" className="mt-3 text-sm text-crimson-light">
            {filesError}
          </p>
        ) : files.length === 0 ? (
          <p className="mt-3 text-sm text-cream-dim">
            No files yet — upload study documents in the Classroom vault first.
          </p>
        ) : (
          <div className="mt-3">
            <label className="block">
              <span className="sr-only">Study file</span>
              <select
                className="input-stage"
                value={selectedFileId}
                onChange={(e) => setSelectedFileId(e.target.value)}
              >
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.file_name ?? 'Untitled file'}
                    {f.extracted_text?.trim() ? '  ● Agron-ready' : '  (text not extracted yet)'}
                  </option>
                ))}
              </select>
            </label>
            {selectedFile && (
              <p className="mt-2 flex items-center gap-2 text-xs text-cream-dim">
                <span
                  className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    selectedReady
                      ? 'bg-gold shadow-[0_0_8px_rgba(232,179,75,0.8)]'
                      : 'bg-cream-dim/30',
                  )}
                  aria-hidden="true"
                />
                {selectedReady ? (
                  <>
                    <span className="text-gold-light">Agron-ready</span> — text extracted and waiting
                    in the wings.
                  </>
                ) : (
                  <>
                    Not Agron-ready yet — upload it in the Classroom so its text can be extracted,
                    then pick it again.
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Generation action cards */}
      <section aria-label="Generate study materials">
        <p className="font-label text-[10px] text-gold-dim">Step 2 · Call Agron to the stage</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => {
            const disabled = busyMode !== null || !selectedFile || !selectedReady;
            return (
              <div key={m.kind} className="card-playbill flex flex-col p-4">
                <m.icon className="h-7 w-7 text-gold" aria-hidden="true" />
                <h3 className="font-display mt-2 text-base font-bold text-cream">{m.title}</h3>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-cream-dim">{m.blurb}</p>
                <button
                  type="button"
                  className="btn-gold mt-3 w-full px-3 py-1.5 text-xs"
                  disabled={disabled}
                  onClick={() => void generate(m.kind)}
                  title={
                    !selectedFile
                      ? 'Pick a file first'
                      : !selectedReady
                        ? 'This file is not Agron-ready yet'
                        : undefined
                  }
                >
                  {busyMode === m.kind ? 'Preparing…' : `Generate ${m.title}`}
                </button>
              </div>
            );
          })}
        </div>

        {busyMode && (
          <p className="mt-4 flex items-center gap-2 text-sm text-gold-light" role="status">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold/25 border-t-gold" />
            Agron is preparing your {busyMode}…
          </p>
        )}
        {!busyMode && selectedFile && !selectedReady && (
          <p className="mt-3 text-xs text-cream-dim">
            Generation is paused until this file&apos;s text is extracted — files with the gold dot
            are ready to go.
          </p>
        )}
        {genError && (
          <p role="alert" className="mt-3 text-sm text-crimson-light">
            {genError}
          </p>
        )}
      </section>

      {/* Result */}
      {result && (
        <section className="card-playbill relative overflow-hidden p-5 sm:p-6" aria-label="Generated material">
          <div className="spotlight" />
          <div className="relative">
            <p className="font-label text-[10px] text-gold-dim">Fresh from Agron&apos;s desk</p>
            <h2 className="font-display mt-1 text-lg font-bold text-gold-light">
              {truncate(resultTitle, 90)}
            </h2>
            <div className="mt-4">
              {result.kind === 'notes' && (
                <div
                  className={markdownClass}
                  // Sanitized by DOMPurify inside renderMarkdown (contract §7).
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(result.markdown) }}
                />
              )}
              {result.kind === 'flashcards' && <FlashcardDeck cards={result.cards} />}
              {result.kind === 'quiz' && <QuizRunner quiz={result.quiz} />}
            </div>
          </div>
        </section>
      )}

      {/* Previously generated materials */}
      <section aria-label="Previously generated materials">
        <h2 className="font-display flex items-center gap-2 text-lg font-bold text-gold-light">
          <Archive className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
          Previously generated
        </h2>
        {materials.length === 0 ? (
          <p className="mt-2 text-sm text-cream-dim">
            Nothing in the archive yet — generated notes, flashcards and quizzes will be listed
            here.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {materials.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => reopen(m)}
                  className="card-ticket w-full p-3 text-left transition hover:border-gold/60"
                >
                  <p className="font-label text-[9px] text-gold-dim">
                    <KindBadge kind={m.kind} />
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-cream">
                    {m.title ?? 'Untitled material'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-cream-dim/80">
                    {formatDateTime(m.created_at)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
