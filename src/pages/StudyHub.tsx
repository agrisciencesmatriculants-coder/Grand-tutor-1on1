import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, GraduationCap } from 'lucide-react';
import StudyGenerator from '../features/study/StudyGenerator';

/**
 * Study Hub (contract §4/§13): header + materials generator (notes,
 * flashcards, quiz) with a link card to the page-by-page reader, which
 * lives on its own route (/study/reader) as a separate lazy chunk.
 */
export default function StudyHub() {
  return (
    <div className="space-y-gr-3">
      {/* Page header */}
      <header className="card-playbill relative overflow-hidden p-5 sm:p-6">
        <div className="spotlight" />
        <div className="relative">
          <p className="font-label text-[10px] text-gold-deep">Study materials</p>
          <h1 className="font-display mt-1 flex items-center gap-2 text-2xl font-bold text-ink sm:text-3xl">
            <GraduationCap className="h-6 w-6 shrink-0 text-gold" aria-hidden="true" />
            Study Hub
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            Turn any uploaded document into summary notes, flashcards and practice quizzes for
            NSC exam preparation.
          </p>
        </div>
      </header>

      <StudyGenerator />

      {/* Link card to the page-by-page reader (separate route, contract §13) */}
      <section aria-label="Page-by-page reader">
        <Link
          to="/study/reader"
          className="card-playbill group flex items-center gap-4 p-5 transition hover:border-gold/60 sm:p-6"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold/10">
            <BookOpen className="h-5 w-5 text-gold-deep" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display block text-lg font-bold text-ink">
              Page-by-Page with Agron
            </span>
            <span className="mt-0.5 block text-sm text-ink-soft">
              Let Agron explain a document one page at a time and answer questions as you read.
            </span>
          </span>
          <ArrowRight
            className="h-5 w-5 shrink-0 text-gold-deep transition group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </section>
    </div>
  );
}
