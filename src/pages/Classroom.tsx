import { useEffect, useState } from 'react';
import { FolderOpen, MessagesSquare, Presentation, type LucideIcon } from 'lucide-react';
import FileVault from '../features/vault/FileVault';
import LiveStage from '../features/stage/LiveStage';
import ChatPanel from '../features/chat/ChatPanel';
import { cn } from '../lib/utils';

type PanelTab = 'stage' | 'chat' | 'files';

const TABS: Array<{ id: PanelTab; label: string; icon: LucideIcon }> = [
  { id: 'stage', label: 'Stage', icon: Presentation },
  { id: 'chat', label: 'Chat', icon: MessagesSquare },
  { id: 'files', label: 'Files', icon: FolderOpen },
];

/** Tracks a media query (used for the lg breakpoint panel-mounting rules, contract §13). */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** App home — 3-panel classroom: File Vault | Live Presentation | Chat (contract §4). */
export default function Classroom() {
  const [tab, setTab] = useState<PanelTab>('stage');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Contract §13 (mobile <lg): mount vault/stage panels ONLY while their tab is
  // active; ChatPanel stays mounted (CSS-hidden) so realtime subscriptions live.
  const mountFiles = isDesktop || tab === 'files';
  const mountStage = isDesktop || tab === 'stage';

  return (
    <div className="flex h-[calc(100vh-10.5rem)] min-h-[32rem] flex-col">
      {/* Mobile / small-screen tab switcher */}
      <div
        className="mb-3 flex gap-1 rounded-lg border border-sand bg-paper p-1 lg:hidden"
        role="tablist"
        aria-label="Classroom panels"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition',
              tab === t.id
                ? 'bg-gold/15 text-gold-deep shadow-[inset_0_0_0_1px_rgba(201,153,46,0.4)]'
                : 'text-ink-soft hover:text-ink',
            )}
          >
            <t.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left: File Vault (unmounted on mobile when its tab is inactive) */}
        {mountFiles && (
          <aside
            className={cn(
              'card-playbill min-h-0 w-full flex-col overflow-hidden p-3',
              'lg:flex lg:w-80 lg:shrink-0',
              tab === 'files' ? 'flex' : 'hidden',
            )}
            aria-label="File vault panel"
          >
            <FileVault />
          </aside>
        )}

        {/* Center: Live presentation (unmounted on mobile when inactive) */}
        {mountStage && (
          <section
            className={cn(
              'relative min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-sand bg-paper shadow-[0_10px_30px_rgba(201,153,46,0.10)]',
              'lg:flex',
              tab === 'stage' ? 'flex' : 'hidden',
            )}
            aria-label="Live presentation panel"
          >
            <div className="flex items-center justify-between border-b border-sand px-4 py-2">
              <span className="font-label flex items-center gap-1.5 text-[11px] text-gold-deep">
                <Presentation className="h-3.5 w-3.5" aria-hidden="true" />
                Live Presentation
              </span>
              <span className="font-label text-[9px] text-ink-soft/60">
                George · Kelebogile · Agron
              </span>
            </div>
            <div className="min-h-0 flex-1 p-3">
              <LiveStage />
            </div>
          </section>
        )}

        {/* Right: Chat — ALWAYS mounted (CSS-hidden when inactive) to keep realtime alive */}
        <aside
          className={cn(
            'card-playbill min-h-0 w-full flex-col overflow-hidden',
            'lg:flex lg:w-96 lg:shrink-0',
            tab === 'chat' ? 'flex' : 'hidden',
          )}
          aria-label="Chat panel"
        >
          <ChatPanel />
        </aside>
      </div>
    </div>
  );
}
