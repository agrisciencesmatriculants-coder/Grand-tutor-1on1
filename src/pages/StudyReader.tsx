import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import PageReader from '../features/study/PageReader';

/**
 * Page-by-page reader route (contract §13): the reader is heavy, so it lives
 * on its own lazy-loaded page instead of inside the Study Hub tab switcher.
 */
export default function StudyReader() {
  return (
    <div className="space-y-gr-3">
      <header className="card-playbill relative overflow-hidden p-5 sm:p-6">
        <div className="spotlight" />
        <div className="relative">
          <p className="font-label text-[10px] text-gold-deep">Guided reading</p>
          <h1 className="font-display mt-1 flex items-center gap-2 text-2xl font-bold text-ink sm:text-3xl">
            <BookOpen className="h-6 w-6 shrink-0 text-gold" aria-hidden="true" />
            Page-by-Page with Agron
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            Agron explains each page of a document in clear language and answers your questions
            as you go.
          </p>
          <Link
            to="/study"
            className="btn-ghost mt-4 px-3 py-1.5 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Study Hub
          </Link>
        </div>
      </header>

      <PageReader />
    </div>
  );
}
