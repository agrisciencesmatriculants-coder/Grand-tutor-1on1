import { useCallback, useEffect, useRef, useState } from 'react';
import { GraduationCap, Loader2, Megaphone, Presentation, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import type { StaffPost } from '../lib/types';

const OWNER_EMAIL = 'youngagripreneurs.ng@gmail.com';
type Room = 'tutors' | 'learners';

/**
 * Meeting rooms (Phase 9): the tutors' meeting and the learners' meeting.
 * Chat format. HR and the Quality Specialist speak here from their weekly
 * observations; the CEO chairs both.
 */
export default function Meetings() {
  const { profile, role } = useAuth();
  const isAdmin = profile?.email === OWNER_EMAIL;
  const isTutor = role === 'teacher';
  const defaultRoom: Room = isTutor && !isAdmin ? 'tutors' : 'learners';

  const [room, setRoom] = useState<Room>(defaultRoom);
  const [posts, setPosts] = useState<StaffPost[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: e } = await supabase
      .from('staff_posts')
      .select('*')
      .eq('kind', 'meeting')
      .in('audience', [room, 'all'])
      .order('created_at', { ascending: true })
      .limit(200);
    if (e) setError(e.message);
    setPosts((data as StaffPost[]) ?? []);
    setLoading(false);
  }, [room]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts]);

  const send = async () => {
    if (!supabase || !profile || !draft.trim() || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      const { error: e } = await supabase.from('staff_posts').insert({
        author_key: isAdmin ? 'ceo' : profile.id,
        author_name: isAdmin ? 'CEO' : (profile.full_name ?? (isTutor ? 'Tutor' : 'Learner')),
        audience: room,
        kind: 'meeting',
        body: text,
      });
      if (e) throw e;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post.');
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const rooms: { id: Room; label: string; icon: React.ReactNode; allowed: boolean }[] = [
    { id: 'tutors', label: "Tutors' meeting", icon: <Presentation className="h-4 w-4" aria-hidden="true" />, allowed: isTutor || isAdmin },
    { id: 'learners', label: "Learners' meeting", icon: <GraduationCap className="h-4 w-4" aria-hidden="true" />, allowed: true },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
          <Megaphone className="h-6 w-6 text-gold-deep" aria-hidden="true" /> Meetings
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Open floor. Management speaks here from their weekly observations — raise what is not working,
          what is working, and what you need.
        </p>
      </header>

      <div className="flex gap-1 border-b border-sand" role="tablist">
        {rooms.filter((r) => r.allowed).map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={room === r.id}
            onClick={() => setRoom(r.id)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition',
              room === r.id ? 'border-gold text-ink' : 'border-transparent text-ink-soft hover:text-ink',
            )}
          >
            {r.icon} {r.label}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto flex items-center gap-1 px-2 text-xs text-ink-soft hover:text-ink"
          onClick={() => void load()}
          aria-label="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
        </button>
      </div>

      {error && <div className="border border-terra/40 bg-terra/5 px-4 py-3 text-sm text-terra" role="alert">{error}</div>}

      <div className="card-playbill flex min-h-[24rem] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-ink-soft">Loading the room…</p>
          ) : posts.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">
              The floor is open. Management posts their observations here after each week's reports.
            </p>
          ) : (
            posts.map((p) => {
              const mine = p.author_key === profile?.id || (p.author_key === 'ceo' && isAdmin);
              const isManager = ['principal', 'hr', 'quality', 'security', 'finance', 'academics', 'learner_success', 'ceo'].includes(p.author_key);
              return (
                <div key={p.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] border px-3 py-2 text-sm',
                      mine
                        ? 'border-gold/40 bg-gold/10 text-ink'
                        : isManager
                          ? 'border-gold/60 bg-white text-ink'
                          : 'border-sand bg-neutral-50 text-ink',
                    )}
                  >
                    <p className="text-xs font-semibold text-gold-deep">{p.author_name}</p>
                    <p className="mt-0.5 whitespace-pre-wrap">{p.body}</p>
                    <p className="mt-1 text-[10px] text-ink-soft/70">{new Date(p.created_at).toLocaleString()}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2 border-t border-sand p-3">
          <input
            className="input-stage flex-1"
            placeholder={`Speak in the ${room === 'tutors' ? "tutors'" : "learners'"} meeting…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
          />
          <button type="button" className="btn-gold flex items-center gap-2" disabled={sending || !draft.trim()} onClick={() => void send()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            Speak
          </button>
        </div>
      </div>
    </div>
  );
}
