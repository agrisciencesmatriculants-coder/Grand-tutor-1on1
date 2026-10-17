import { useCallback, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TitleSuggestion {
  title: string;
  description?: string;
}

/**
 * AI lesson-title assistant (Phase 5): calls the tutor-assist edge function
 * and lets the tutor apply a suggestion with one click.
 */
export default function AiTitleSuggest({
  topic,
  subject,
  grade,
  onPick,
}: {
  topic: string;
  subject: string;
  grade: string;
  onPick: (title: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([]);

  const suggest = useCallback(async () => {
    if (!supabase || !topic.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('tutor-assist', {
        body: { mode: 'title', topic: topic.trim(), subject, grade, count: 4 },
      });
      if (fnErr) throw new Error(fnErr.message ?? 'AI request failed.');
      if (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)) {
        throw new Error(String((data as Record<string, unknown>).error));
      }
      const items = (data as { items?: unknown }).items;
      setSuggestions(Array.isArray(items) ? (items as TitleSuggestion[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI request failed.');
    } finally {
      setBusy(false);
    }
  }, [busy, grade, subject, topic]);

  return (
    <div className="rounded-md border border-sand bg-ivory-deep/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !topic.trim()}
          onClick={() => void suggest()}
          title={topic.trim() ? 'Suggest titles with AI' : 'Enter a topic or title first'}
          className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5 text-gold-deep" aria-hidden="true" />
          {busy ? 'Asking the AI…' : 'Suggest title with AI'}
        </button>
        <span className="text-xs text-ink-soft">Uses the topic field; 20 AI calls per day.</span>
      </div>
      {error && <p className="mt-2 text-xs text-terra-deep" role="alert">{error}</p>}
      {suggestions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onPick(s.title)}
                className="w-full rounded-md border border-sand bg-paper px-3 py-1.5 text-left text-sm text-ink transition hover:border-gold"
                title={s.description ?? s.title}
              >
                {s.title}
                {s.description && <span className="block text-xs text-ink-soft">{s.description}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
