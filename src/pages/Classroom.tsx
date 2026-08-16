import { useState } from 'react';
import { Drama, FolderOpen, MessagesSquare, Star, type LucideIcon } from 'lucide-react';
import FileVault from '../features/vault/FileVault';
import LiveStage from '../features/stage/LiveStage';
import ChatPanel from '../features/chat/ChatPanel';
import { cn } from '../lib/utils';

type PanelTab = 'stage' | 'chat' | 'files';

const TABS: Array<{ id: PanelTab; label: string; icon: LucideIcon }> = [
  { id: 'stage', label: 'Stage', icon: Drama },
  { id: 'chat', label: 'Chat', icon: MessagesSquare },
  { id: 'files', label: 'Files', icon: FolderOpen },
];

/** App home — 3-panel classroom: File Vault | Live Stage | Chat (contract §4). */
export default function Classroom() {
  const [tab, setTab] = useState<PanelTab>('stage');

  return (
    <div className="flex h-[calc(100vh-10.5rem)] min-h-[32rem] flex-col">
      {/* Mobile / small-screen tab switcher */}
      <div
        className="mb-3 flex gap-1 rounded-lg border border-gold/20 bg-stage-panel/60 p-1 lg:hidden"
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
                ? 'bg-gold/15 text-gold-light shadow-[inset_0_0_0_1px_rgba(232,179,75,0.35)]'
                : 'text-cream-dim hover:text-cream',
            )}
          >
            <t.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left: File Vault */}
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

        {/* Center: Live Stage (theatrical framing) */}
        <section
          className={cn(
            'relative min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-gold/40 bg-stage-panel/50 shadow-[0_0_40px_rgba(232,179,75,0.08)]',
            'lg:flex',
            tab === 'stage' ? 'flex' : 'hidden',
          )}
          aria-label="Live stage panel"
        >
          <div className="flex items-center justify-between border-b border-gold/25 px-4 py-2">
            <span className="font-label flex items-center gap-1.5 text-[11px] text-gold">
              <Star className="h-3 w-3 fill-gold text-gold" aria-hidden="true" />
              Live Stage
              <Star className="h-3 w-3 fill-gold text-gold" aria-hidden="true" />
            </span>
            <span className="font-label text-[9px] text-cream-dim/60">
              George · Kelebogile · Agron
            </span>
          </div>
          <div className="min-h-0 flex-1 p-3">
            <LiveStage />
          </div>
        </section>

        {/* Right: Chat */}
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
