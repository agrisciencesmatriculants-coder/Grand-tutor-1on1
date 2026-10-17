import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Loader2, MessageCircle, Send } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface LibraryMessage {
  id: string;
  sender: 'member' | 'agent';
  text: string;
  created_at: string;
}

const READING_LIST = [
  { title: 'Study techniques that actually work', blurb: 'Spaced repetition and active recall — the two habits behind every top matric result.' },
  { title: 'How telegraph lessons save your data', blurb: 'Why a drawn lesson costs kilobytes while video costs megabytes.' },
  { title: 'Preparing for the NSC exams', blurb: 'A calm, week-by-week approach to past papers.' },
  { title: 'From high school to university', blurb: 'What changes, what stays the same, and how to bridge the gap.' },
];

/**
 * The Library (Phase 10): what a member under a soft hold sees — a pleasant,
 * normal-looking reading room with a "routine member-experience survey" from
 * the research team. Nothing here hints at review or security; that is the
 * point. The survey agent's transcript goes to the CSO and CEO.
 */
export default function Library() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<LibraryMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('library_chats')
      .select('id, sender, text, created_at')
      .order('created_at', { ascending: true })
      .limit(100);
    const rows = (data as LibraryMessage[]) ?? [];
    setMessages(rows);
    if (rows.length > 0) setStarted(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const talk = async (message: string) => {
    const { data, error } = await supabase!.functions.invoke('library-survey', {
      body: { message },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    if (data?.agent) setAgentName(data.agent);
    await load();
  };

  const start = async () => {
    setStarting(true);
    try {
      await talk('');
      setStarted(true);
    } finally {
      setStarting(false);
    }
  };

  const send = async () => {
    if (!draft.trim() || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      await talk(text);
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
          <BookOpen className="h-6 w-6 text-gold-deep" aria-hidden="true" /> The Library
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          A quiet room while we prepare your full access — usually ready within a few hours.
        </p>
      </header>

      {/* Survey card */}
      <section className="card-playbill p-5">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
          <div className="flex-1">
            <h2 className="font-semibold text-ink">Member-experience survey</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Our research team is running a two-minute survey today and your account was selected.
              Your answers directly shape what we improve next.
            </p>
          </div>
        </div>

        {!started ? (
          <button
            type="button"
            className="btn-gold mt-4 flex items-center gap-2"
            disabled={starting}
            onClick={() => void start()}
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Start the survey
          </button>
        ) : (
          <div className="mt-4 flex min-h-48 flex-col border border-sand">
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {messages.map((m) => (
                <div key={m.id} className={m.sender === 'member' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={
                      m.sender === 'member'
                        ? 'max-w-[80%] border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-ink'
                        : 'max-w-[80%] border border-sand bg-neutral-50 px-3 py-2 text-sm text-ink'
                    }
                  >
                    {m.sender === 'agent' && agentName && (
                      <p className="text-xs font-semibold text-gold-deep">{agentName}</p>
                    )}
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="flex gap-2 border-t border-sand p-3">
              <input
                className="input-stage flex-1"
                placeholder="Your answer…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
              />
              <button type="button" className="btn-gold flex items-center gap-2" disabled={sending || !draft.trim()} onClick={() => void send()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                Send
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Reading room */}
      <section className="card-playbill p-5">
        <h2 className="font-semibold text-ink">While you wait — this week's reading</h2>
        <ul className="mt-3 divide-y divide-sand">
          {READING_LIST.map((r) => (
            <li key={r.title} className="py-3">
              <p className="text-sm font-medium text-ink">{r.title}</p>
              <p className="mt-0.5 text-sm text-ink-soft">{r.blurb}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-soft/70">
          Full access unlocks automatically — no action needed beyond the survey.
        </p>
      </section>

      <p className="text-center text-xs text-ink-soft/60">
        Signed in as {profile?.email}
      </p>
    </div>
  );
}
