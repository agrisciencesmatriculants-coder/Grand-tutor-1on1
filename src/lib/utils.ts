import type { Session } from './types';

/** Merge class names, dropping falsy values. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** "14:05" style local time. */
export function formatTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** "Fri, 14 Jun" style local date. */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Fri, 14 Jun · 14:05" combined. */
export function formatDateTime(iso: string | Date): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

function gcalStamp(dateIso: string): string {
  // YYYYMMDDTHHMMSSZ in UTC
  return new Date(dateIso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Build a Google Calendar "Add event" template link for a session.
 * https://calendar.google.com/calendar/render?action=TEMPLATE&text=..&dates=../..&details=..&location=..
 */
export function gcalLink(session: Pick<Session, 'title' | 'description' | 'start_at' | 'end_at' | 'location'>): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: session.title,
    dates: `${gcalStamp(session.start_at)}/${gcalStamp(session.end_at)}`,
    details: session.description ?? '',
    location: session.location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Return the URL only if it is https://, otherwise null (blocks javascript:/data: sinks). */
export const safeUrl = (u: string | null | undefined): string | null =>
  u && /^https:\/\//i.test(u) ? u : null;

/** Truncate a string with an ellipsis. */
export function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Human-readable file size. */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
