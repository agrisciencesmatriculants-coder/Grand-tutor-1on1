import { useState } from 'react';
import { BookOpen, GraduationCap, Sparkles, type LucideIcon } from 'lucide-react';
import StudyGenerator from '../features/study/StudyGenerator';
import PageReader from '../features/study/PageReader';
import { cn } from '../lib/utils';

type Tab = 'generate' | 'reader';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'generate', label: 'Generate Materials', icon: Sparkles },
  { id: 'reader', label: 'Page-by-Page with Agron', icon: BookOpen },
];

/**
 * Study Hub (contract §4): playbill header + tab switcher between the
 * materials generator and the page-by-page reader.
 */
export default function StudyHub() {
  const [tab, setTab] = useState<Tab>('generate');

  return (
    <div className="space-y-6">
      {/* Playbill page header */}
      <header className="card-playbill relative overflow-hidden p-5 sm:p-6">
        <div className="spotlight" />
        <div className="relative">
          <p className="font-label text-[10px] text-gold-dim">The rehearsal room</p>
          <h1 className="font-display mt-1 flex items-center gap-2 text-2xl font-bold text-gold-light sm:text-3xl">
            <GraduationCap className="h-6 w-6 shrink-0 text-gold" aria-hidden="true" />
            Study Hub — Rehearse for the NSC
          </h1>
          <p className="mt-1 max-w-xl text-sm text-cream-dim">
            Turn any vault document into notes, flashcards and practice quizzes — or let Agron walk
            Kelebogile through it page by page before exam day&apos;s opening night.
          </p>

          {/* Tab switcher */}
          <div
            role="tablist"
            aria-label="Study Hub sections"
            className="mt-4 inline-flex flex-wrap gap-1 rounded-lg border border-gold/20 bg-stage-deep/60 p-1"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition sm:px-4',
                  tab === t.id
                    ? 'bg-gold/15 text-gold-light shadow-[inset_0_0_0_1px_rgba(232,179,75,0.35)]'
                    : 'text-cream-dim hover:bg-gold/5 hover:text-cream',
                )}
              >
                <t.icon className="h-4 w-4" aria-hidden="true" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {tab === 'generate' ? <StudyGenerator /> : <PageReader />}
    </div>
  );
}
