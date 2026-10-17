import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Renders a "Take the quiz" link when a quiz exists for the given telegraph
 * script; renders nothing otherwise. Used on VukaTV cards and the player.
 * The non-block variant is a <button> so it can legally sit inside a card link.
 */
export default function QuizLink({ scriptId, block = false }: { scriptId: string; block?: boolean }) {
  const [quizId, setQuizId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabase || !scriptId) return;
    let cancelled = false;
    supabase
      .from('quizzes')
      .select('id')
      .eq('script_id', scriptId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setQuizId((data as { id: string }).id);
      });
    return () => {
      cancelled = true;
    };
  }, [scriptId]);

  if (!quizId) return null;

  if (block) {
    return (
      <Link
        to={`/quiz/${quizId}`}
        className="btn-gold mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm"
      >
        <CircleHelp className="h-4 w-4" aria-hidden="true" /> Take the quiz
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/quiz/${quizId}`);
      }}
      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gold-deep hover:underline"
    >
      <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" /> Take the quiz
    </button>
  );
}
