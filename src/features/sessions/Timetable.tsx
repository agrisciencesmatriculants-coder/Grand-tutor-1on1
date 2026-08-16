import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, MapPin, Ticket } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import type { Session } from '../../lib/types';
import { cn, formatDate, formatTime, gcalLink } from '../../lib/utils';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PX_PER_HOUR = 56;

/** Monday 00:00 of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // Mon = 0
  out.setDate(out.getDate() - dow);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "Today" / "Tomorrow" / "in N days" relative to now (date granularity). */
export function relativeDayLabel(iso: string): string {
  const now = new Date();
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((dayStart(new Date(iso)) - dayStart(now)) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return `in ${diffDays} days`;
}

export interface TimetableProps {
  /** Called when the user chooses to edit a session they may edit. */
  onEdit?: (session: Session) => void;
}

/**
 * Weekly timetable (Mon–Sun positioned blocks) + upcoming sessions playbill.
 * Subscribes to realtime INSERT/UPDATE/DELETE on `sessions` (contract §6).
 */
export default function Timetable({ onEdit }: TimetableProps) {
  const { profile, role } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase
      .from('sessions')
      .select('*')
      .order('start_at', { ascending: true });
    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setSessions((data ?? []) as Session[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    void load();
    const channel = client
      .channel('sessions-timetable')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [load]);

  const canManage = useCallback(
    (s: Session) => role === 'teacher' || (profile != null && s.created_by === profile.id),
    [role, profile],
  );

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const weekSessions = useMemo(
    () =>
      sessions.filter((s) => {
        const start = new Date(s.start_at);
        return start >= weekStart && start < weekEnd;
      }),
    [sessions, weekStart, weekEnd],
  );

  // Visible hours window: derived from the week's sessions, default 07:00–19:00.
  const { windowStartMin, windowEndMin } = useMemo(() => {
    let min = 7 * 60;
    let max = 19 * 60;
    for (const s of weekSessions) {
      const st = new Date(s.start_at);
      const en = new Date(s.end_at);
      min = Math.min(min, st.getHours() * 60 + st.getMinutes());
      max = Math.max(max, en.getHours() * 60 + en.getMinutes());
    }
    min = Math.max(0, Math.floor(min / 60) * 60 - 60);
    max = Math.min(24 * 60, Math.ceil(max / 60) * 60 + 60);
    if (max - min < 4 * 60) max = Math.min(24 * 60, min + 4 * 60);
    return { windowStartMin: min, windowEndMin: max };
  }, [weekSessions]);

  const spanMin = windowEndMin - windowStartMin;
  const gridHeight = ((spanMin / 60) * PX_PER_HOUR) | 0;
  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = windowStartMin; m <= windowEndMin; m += 60) marks.push(m);
    return marks;
  }, [windowStartMin, windowEndMin]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return sessions.filter((s) => new Date(s.end_at) >= now).slice(0, 8);
  }, [sessions]);

  async function handleDelete(s: Session) {
    if (!supabase || deletingId) return;
    setError(null);
    setDeletingId(s.id);
    const { error: err } = await supabase.from('sessions').delete().eq('id', s.id);
    if (err) setError(`Could not remove “${s.title}”: ${err.message}`);
    // On success the realtime DELETE event refreshes the list.
    setDeletingId(null);
  }

  const weekLabel = `${formatDate(weekStart)} — ${formatDate(addDays(weekStart, 6))}`;

  return (
    <section aria-label="Weekly timetable" className="space-y-6">
      {/* Week navigation */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-label text-[10px] text-gold-dim">This week's stage schedule</p>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
          >
            ← Prev week
          </button>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
          >
            This week
          </button>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
          >
            Next week →
          </button>
        </div>
        <p className="w-full text-sm text-cream-dim sm:w-auto sm:text-right">{weekLabel}</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-crimson-light">
          {error}
        </p>
      )}

      {/* Week grid */}
      <div className="card-playbill overflow-x-auto p-3 sm:p-4">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[3.25rem_repeat(7,1fr)] gap-1">
            <div /> {/* corner above hour labels */}
            {weekDays.map((day) => {
              const isToday = sameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'rounded-md border px-1 py-1.5 text-center',
                    isToday
                      ? 'border-gold/50 bg-gold/10 text-gold-light'
                      : 'border-gold/10 text-cream-dim',
                  )}
                >
                  <p className="font-label text-[10px]">{DAY_LABELS[(day.getDay() + 6) % 7]}</p>
                  <p className={cn('font-display text-sm font-bold', isToday && 'text-gold')}>
                    {day.getDate()}
                  </p>
                </div>
              );
            })}

            {/* Hour gutter */}
            <div className="relative" style={{ height: gridHeight }}>
              {hourMarks.map((m) => (
                <span
                  key={m}
                  className="font-label absolute right-1 -translate-y-1/2 text-[9px] text-cream-dim/60"
                  style={{ top: `${((m - windowStartMin) / spanMin) * 100}%` }}
                >
                  {String(Math.floor(m / 60)).padStart(2, '0')}:00
                </span>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day) => {
              const isToday = sameDay(day, new Date());
              const daySessions = weekSessions.filter((s) => sameDay(new Date(s.start_at), day));
              return (
                <div
                  key={`col-${day.toISOString()}`}
                  className={cn(
                    'relative rounded-md border',
                    isToday ? 'border-gold/25 bg-gold/[0.04]' : 'border-gold/10 bg-stage-deep/40',
                  )}
                  style={{ height: gridHeight }}
                >
                  {hourMarks.slice(0, -1).map((m) => (
                    <div
                      key={m}
                      className="absolute left-0 right-0 border-t border-gold/5"
                      style={{ top: `${((m - windowStartMin) / spanMin) * 100}%` }}
                    />
                  ))}
                  {daySessions.map((s) => {
                    const st = new Date(s.start_at);
                    const en = new Date(s.end_at);
                    const startMin = st.getHours() * 60 + st.getMinutes();
                    let endMin = en.getHours() * 60 + en.getMinutes();
                    if (!sameDay(st, en) || endMin <= startMin) endMin = 24 * 60;
                    const top = Math.max(0, ((startMin - windowStartMin) / spanMin) * 100);
                    const height = Math.max(
                      6,
                      ((Math.min(endMin, windowEndMin) - Math.max(startMin, windowStartMin)) /
                        spanMin) *
                        100,
                    );
                    return (
                      <button
                        key={s.id}
                        type="button"
                        title={`${s.title} · ${formatTime(s.start_at)}–${formatTime(s.end_at)}${
                          canManage(s) && onEdit ? ' · click to edit' : ''
                        }`}
                        onClick={() => {
                          if (onEdit && canManage(s)) onEdit(s);
                        }}
                        className={cn(
                          'absolute left-0.5 right-0.5 overflow-hidden rounded border border-gold/40 bg-gradient-to-b from-gold/25 to-gold/10 px-1 py-0.5 text-left transition hover:border-gold/70 hover:from-gold/35',
                          !(onEdit && canManage(s)) && 'cursor-default',
                        )}
                        style={{ top: `${top}%`, height: `${height}%`, minHeight: '1.6rem' }}
                      >
                        <span className="block truncate text-[10px] font-semibold leading-tight text-gold-light">
                          {s.title}
                        </span>
                        <span className="font-label block text-[8px] leading-tight text-cream-dim">
                          {formatTime(s.start_at)}–{formatTime(s.end_at)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        {!loading && weekSessions.length === 0 && (
          <p className="mt-3 text-center text-xs text-cream-dim">
            No sessions this week — an open stage awaiting a scene.
          </p>
        )}
      </div>

      {/* Upcoming sessions — "Next on the playbill" */}
      <div>
        <h3 className="font-display flex items-center gap-2 text-lg font-bold text-gold-light">
          <Ticket className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
          Next on the playbill
        </h3>
        {loading ? (
          <p className="mt-3 text-sm text-cream-dim">Consulting the stage manager…</p>
        ) : upcoming.length === 0 ? (
          <div className="card-playbill mt-3 border-dashed p-6 text-center">
            <p className="text-sm text-cream-dim">
              No upcoming sessions. George or Kelebogile can book one with “New Session” above.
            </p>
          </div>
        ) : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {upcoming.map((s) => (
              <li
                key={s.id}
                className="card-ticket relative border-dashed p-4"
              >
                {/* perforated-edge vibe */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-2 left-0 w-px border-l border-dashed border-gold/40"
                />
                <div className="flex items-start justify-between gap-3 pl-2">
                  <div className="min-w-0">
                    <p className="font-label text-[9px] text-gold-dim">
                      {relativeDayLabel(s.start_at)}
                    </p>
                    <h4 className="font-display mt-0.5 truncate text-base font-bold text-cream">
                      {s.title}
                    </h4>
                    {s.subject && (
                      <p className="mt-0.5 truncate text-xs text-gold-light/90">{s.subject}</p>
                    )}
                    <p className="mt-1 text-xs text-cream-dim">
                      {formatDate(s.start_at)} · {formatTime(s.start_at)}–{formatTime(s.end_at)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-cream-dim/80">
                      <MapPin className="mr-1 inline h-3 w-3 text-gold-dim" aria-hidden="true" />
                      {s.location}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <a
                      href={gcalLink(s)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost px-2.5 py-1 text-[11px]"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      Add to Google Calendar
                    </a>
                    {canManage(s) && (
                      <div className="flex gap-1.5">
                        {onEdit && (
                          <button
                            type="button"
                            className="btn-ghost px-2.5 py-1 text-[11px]"
                            onClick={() => onEdit(s)}
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-ghost border-crimson/60 px-2.5 py-1 text-[11px] text-crimson-light hover:bg-crimson/15"
                          onClick={() => void handleDelete(s)}
                          disabled={deletingId === s.id}
                        >
                          {deletingId === s.id ? 'Removing…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
