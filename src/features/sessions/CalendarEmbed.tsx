import { CalendarDays } from 'lucide-react';
import { gcalId } from '../../lib/supabase';

/**
 * Embeds the shared Google Calendar when VITE_GCAL_ID is configured
 * (contract §6), otherwise shows a tasteful hint for George.
 */
export default function CalendarEmbed() {
  if (!gcalId) {
    return (
      <section aria-label="Google Calendar" className="card-playbill border-dashed p-6 text-center">
        <CalendarDays className="mx-auto h-8 w-8 text-gold" aria-hidden="true" />
        <h3 className="font-display mt-2 text-lg font-bold text-ink">
          Shared calendar not configured
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          George can add <code className="notranslate font-mono text-gold-deep" translate="no">VITE_GCAL_ID</code> (a
          Google Calendar ID) to the environment variables to display the shared Google Calendar
          on this page.
        </p>
      </section>
    );
  }

  const src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(
    gcalId,
  )}&ctz=Africa/Johannesburg`;

  return (
    <section aria-label="Google Calendar" className="card-playbill relative overflow-hidden p-4 sm:p-5">
      <div className="spotlight" />
      <div className="relative">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="font-display flex items-center gap-2 text-lg font-bold text-ink">
            <CalendarDays className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
            Shared Google Calendar
          </h3>
          <p className="font-label text-[9px] text-ink-soft/70">Africa/Johannesburg</p>
        </div>
        <div className="overflow-hidden rounded-lg border border-gold/25 bg-ivory-deep">
          <iframe
            title="Shared Google Calendar"
            src={src}
            className="h-[480px] w-full sm:h-[560px]"
            style={{ border: 0 }}
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
