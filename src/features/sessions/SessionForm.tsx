import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import type { Session } from '../../lib/types';

/** "2025-06-14" style local date for <input type="date">. */
function toDateInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "14:05" style local time for <input type="time">. */
function toTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayDateInput(): string {
  return toDateInput(new Date().toISOString());
}

export interface SessionFormProps {
  /** When set, the form edits this session; otherwise it creates a new one. */
  editing?: Session | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

/**
 * Create/edit form for named sessions (contract §2 `sessions`).
 * Both roles may create; the caller only renders this for editing when the
 * user is the teacher or the creator (RLS enforces the rest).
 */
export default function SessionForm({ editing = null, onSaved, onCancel }: SessionFormProps) {
  const { profile } = useAuth();

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayDateInput());
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('17:00');
  const [location, setLocation] = useState('Online — Live Stage');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate fields when editing a session (or reset for a fresh form).
  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setSubject(editing.subject ?? '');
      setDescription(editing.description ?? '');
      setDate(toDateInput(editing.start_at));
      setStartTime(toTimeInput(editing.start_at));
      setEndTime(toTimeInput(editing.end_at));
      setLocation(editing.location || 'Online — Live Stage');
    } else {
      setTitle('');
      setSubject('');
      setDescription('');
      setDate(todayDateInput());
      setStartTime('16:00');
      setEndTime('17:00');
      setLocation('Online — Live Stage');
    }
    setError(null);
  }, [editing]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return;
    if (!profile) {
      setError('You must be signed in to save a session.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please give the session a title.');
      return;
    }
    if (!date || !startTime || !endTime) {
      setError('Please pick a date, start time and end time.');
      return;
    }

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('That date or time does not look right.');
      return;
    }
    if (end <= start) {
      setError('The end time must be after the start time.');
      return;
    }

    const payload = {
      title: trimmedTitle,
      subject: subject.trim() || null,
      description: description.trim() || null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      location: location.trim() || 'Online — Live Stage',
    };

    setSaving(true);
    try {
      if (editing) {
        const { error: err } = await supabase
          .from('sessions')
          .update(payload)
          .eq('id', editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('sessions')
          .insert({ ...payload, created_by: profile.id });
        if (err) throw err;
      }
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the session.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-playbill relative overflow-hidden p-5 sm:p-6"
      aria-label={editing ? 'Edit session' : 'New session'}
    >
      <div className="spotlight" />
      <div className="relative">
        <p className="font-label text-[10px] text-gold-dim">
          {editing ? 'Rewriting the playbill' : 'Adding to the playbill'}
        </p>
        <h2 className="font-display mt-1 text-xl font-bold text-gold-light">
          {editing ? `Edit “${editing.title}”` : 'New Session'}
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="font-label mb-1 block text-[10px] text-cream-dim">
              Title <span className="text-crimson-light">*</span>
            </span>
            <input
              type="text"
              className="input-stage"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Agricultural Sciences — Genetics revision"
              required
              maxLength={140}
            />
          </label>

          <label className="block">
            <span className="font-label mb-1 block text-[10px] text-cream-dim">Subject</span>
            <input
              type="text"
              className="input-stage"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Agricultural Sciences"
              maxLength={80}
            />
          </label>

          <label className="block">
            <span className="font-label mb-1 block text-[10px] text-cream-dim">Location</span>
            <input
              type="text"
              className="input-stage"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Online — Live Stage"
              maxLength={120}
            />
          </label>

          <label className="block">
            <span className="font-label mb-1 block text-[10px] text-cream-dim">Date</span>
            <input
              type="date"
              className="input-stage [color-scheme:dark]"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-label mb-1 block text-[10px] text-cream-dim">Starts</span>
              <input
                type="time"
                className="input-stage [color-scheme:dark]"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="font-label mb-1 block text-[10px] text-cream-dim">Ends</span>
              <input
                type="time"
                className="input-stage [color-scheme:dark]"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="block sm:col-span-2">
            <span className="font-label mb-1 block text-[10px] text-cream-dim">Description</span>
            <textarea
              className="input-stage min-h-[5rem] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will we rehearse? Topics, pages to prepare, what to bring…"
              maxLength={600}
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-crimson-light">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-gold" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Book the session'}
          </button>
          {onCancel && (
            <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
