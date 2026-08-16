import { useState } from 'react';
import { Drama } from 'lucide-react';
import SessionForm from '../features/sessions/SessionForm';
import Timetable from '../features/sessions/Timetable';
import CalendarEmbed from '../features/sessions/CalendarEmbed';
import type { Session } from '../lib/types';
import { cn } from '../lib/utils';

/**
 * Sessions & Timetable (contract §4): playbill header, "New Session" toggle
 * revealing SessionForm (create or edit), weekly Timetable, Google Calendar
 * embed below.
 */
export default function Sessions() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen((open) => (editing ? true : !open));
  }

  function openEdit(session: Session) {
    setEditing(session);
    setFormOpen(true);
    // Bring the form into view on small screens.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      {/* Playbill page header */}
      <header className="card-playbill relative overflow-hidden p-5 sm:p-6">
        <div className="spotlight" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="min-w-0">
            <p className="font-label text-[10px] text-gold-dim">The playbill</p>
            <h1 className="font-display mt-1 flex items-center gap-2 text-2xl font-bold text-gold-light sm:text-3xl">
              <Drama className="h-6 w-6 shrink-0 text-gold" aria-hidden="true" />
              Sessions &amp; Timetable
            </h1>
            <p className="mt-1 max-w-xl text-sm text-cream-dim">
              Every tutoring session is a ticketed performance. Book a seat, check the week&apos;s
              schedule, and add shows to your Google Calendar.
            </p>
          </div>
          <button
            type="button"
            className={cn('ml-auto', formOpen && !editing ? 'btn-ghost' : 'btn-gold')}
            onClick={openCreate}
            aria-expanded={formOpen}
          >
            {formOpen && !editing ? 'Close form' : '＋ New Session'}
          </button>
        </div>
      </header>

      {formOpen && (
        <SessionForm
          editing={editing}
          onSaved={closeForm}
          onCancel={closeForm}
        />
      )}

      <Timetable onEdit={openEdit} />

      <CalendarEmbed />
    </div>
  );
}
