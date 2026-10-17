import { useEffect, useState } from 'react';
import { BarChart3, CircleDollarSign, ClipboardCheck, Radio } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

interface Stats {
  lessons: number;
  broadcasts: number;
  attempts: number;
  avgScore: number | null;
  vp: number;
}

/**
 * Tutor analytics (Phase 5): a compact performance strip for the Studio —
 * lessons recorded, broadcasts aired, learner quiz attempts and average
 * score on the tutor's quizzes, and total VP earned.
 */
export default function StudioAnalytics() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!supabase || !profile) return;
    const client = supabase;
    const uid = profile.id;
    let cancelled = false;

    async function load() {
      const [scriptsRes, myQuizzesRes, ledgerRes] = await Promise.all([
        client.from('telegraph_scripts').select('id', { count: 'exact', head: true }).eq('tutor_id', uid),
        client.from('quizzes').select('id').eq('tutor_id', uid),
        client.from('vp_ledger').select('amount').eq('tutor_id', uid),
      ]);
      const quizIds = ((myQuizzesRes.data ?? []) as { id: string }[]).map((q) => q.id);

      let broadcasts = 0;
      let attempts = 0;
      let avgScore: number | null = null;

      const scriptIds = await client
        .from('telegraph_scripts')
        .select('id')
        .eq('tutor_id', uid)
        .then((r) => ((r.data ?? []) as { id: string }[]).map((s) => s.id));
      if (scriptIds.length > 0) {
        const bc = await client
          .from('broadcasts')
          .select('id', { count: 'exact', head: true })
          .in('script_id', scriptIds);
        broadcasts = bc.count ?? 0;
      }
      if (quizIds.length > 0) {
        const att = await client.from('quiz_attempts').select('score_pct').in('quiz_id', quizIds);
        const rows = (att.data ?? []) as { score_pct: number }[];
        attempts = rows.length;
        if (rows.length > 0) {
          avgScore = Math.round(rows.reduce((n, r) => n + r.score_pct, 0) / rows.length);
        }
      }

      if (cancelled) return;
      setStats({
        lessons: scriptsRes.count ?? 0,
        broadcasts,
        attempts,
        avgScore,
        vp: ((ledgerRes.data ?? []) as { amount: number }[]).reduce((n, r) => n + r.amount, 0),
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (!stats) return null;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Studio analytics">
      <Stat icon={<Radio className="h-4 w-4" />} label="Lessons recorded" value={String(stats.lessons)} sub={`${stats.broadcasts} broadcasts aired`} />
      <Stat
        icon={<ClipboardCheck className="h-4 w-4" />}
        label="Quiz attempts on your lessons"
        value={String(stats.attempts)}
        sub={stats.avgScore !== null ? `Average learner score ${stats.avgScore}%` : 'No attempts yet'}
      />
      <Stat icon={<CircleDollarSign className="h-4 w-4" />} label="Vuka Points earned" value={stats.vp.toLocaleString('en-ZA')} sub="From learner quiz improvement" />
      <Stat
        icon={<BarChart3 className="h-4 w-4" />}
        label="Impact per lesson"
        value={stats.lessons > 0 ? (stats.attempts / stats.lessons).toFixed(1) : '0'}
        sub="Quiz attempts per recorded lesson"
      />
    </section>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="card-playbill p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
        {icon} {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>
    </div>
  );
}
