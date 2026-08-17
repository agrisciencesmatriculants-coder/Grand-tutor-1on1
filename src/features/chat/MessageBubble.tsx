import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Check, CheckCheck, Download, Sparkles } from 'lucide-react';
import type { Message, MessageStatus, SenderRole } from '../../lib/types';
import { cn, formatTime, safeUrl } from '../../lib/utils';
import FileTypeIcon from '../../components/FileTypeIcon';

const SENDER_LABEL: Record<SenderRole, string> = {
  teacher: 'George',
  student: 'Kelebogile',
  ai: 'Agron',
};

/** Markdown → sanitized HTML (contract §7: sanitize everything rendered as HTML). */
function mdToHtml(text: string): string {
  const raw = marked.parse(text, { async: false, breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(raw);
}

function Markdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => mdToHtml(text), [text]);
  return (
    <div
      translate="no"
      className={cn(
        'notranslate',
        'break-words text-sm leading-relaxed',
        '[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_a]:text-gold-deep [&_a]:underline [&_a]:underline-offset-2',
        '[&_strong]:font-semibold [&_strong]:text-ink',
        '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5',
        '[&_code]:rounded [&_code]:bg-ivory-deep [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8em] [&_code]:text-gold-deep',
        '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-sand [&_pre]:bg-ivory-deep [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_blockquote]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-gold/50 [&_blockquote]:pl-3 [&_blockquote]:text-ink-soft',
        '[&_h1]:font-display [&_h1]:text-lg [&_h1]:text-ink [&_h2]:font-display [&_h2]:text-base [&_h2]:text-ink [&_h3]:font-display [&_h3]:text-sm [&_h3]:text-ink',
        '[&_hr]:my-2 [&_hr]:border-sand',
        '[&_table]:my-2 [&_table]:text-xs [&_th]:border [&_th]:border-sand [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-sand [&_td]:px-2 [&_td]:py-1',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** WhatsApp-style read ticks (contract §6): single check sent grey, double check delivered grey, double check read gold. */
function Ticks({ status }: { status: MessageStatus }) {
  if (status === 'read') {
    return (
      <span title="Read" className="inline-flex items-center text-[#a07c1f]">
        <CheckCheck className="h-3 w-3" aria-hidden="true" />
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span title="Delivered" className="inline-flex items-center text-ink-soft/70">
        <CheckCheck className="h-3 w-3" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span title="Sent" className="inline-flex items-center text-ink-soft/50">
      <Check className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}

function Attachment({ message }: { message: Message }) {
  const audioUrl = safeUrl(message.audio_url);
  if (message.audio_url) {
    if (!audioUrl) return null;
    return (
      <audio
        controls
        preload="metadata"
        src={audioUrl}
        className="mt-1.5 h-9 w-full max-w-[16rem] rounded-lg"
      />
    );
  }
  const url = safeUrl(message.file_url);
  if (!url) return null;
  const isImage =
    (message.file_type ?? '').toLowerCase().startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(message.file_name ?? '');
  if (isImage) {
    return (
      <button
        type="button"
        onClick={() => window.open(url, '_blank', 'noopener')}
        className="mt-1.5 block"
        title={message.file_name ?? 'Open image'}
      >
        <img
          src={url}
          alt={message.file_name ?? 'Attached image'}
          loading="lazy"
          className="max-h-48 max-w-full rounded-lg border border-sand object-cover transition hover:border-gold/60"
        />
      </button>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={message.file_name ?? undefined}
      className="mt-1.5 inline-flex max-w-full items-center gap-2 rounded-lg border border-sand bg-ivory-deep px-3 py-1.5 text-xs text-gold-deep transition hover:bg-gold/10"
    >
      <FileTypeIcon type={message.file_type ?? message.file_name} />
      <span className="max-w-[12rem] truncate">{message.file_name ?? 'Download file'}</span>
      <Download className="h-3.5 w-3.5 shrink-0 text-ink-soft/60" aria-hidden="true" />
    </a>
  );
}

export interface MessageBubbleProps {
  message: Message;
  /** True when the message was sent by the currently signed-in user. */
  own: boolean;
}

/** Presentational chat bubble: own right (gold tint), other left (white), AI centred (dashed gold). */
export default function MessageBubble({ message, own }: MessageBubbleProps) {
  const time = formatTime(message.created_at);

  if (message.sender_role === 'ai') {
    return (
      <div className="my-2 flex justify-center">
        <div className="w-full max-w-[92%] rounded-xl border border-dashed border-gold/60 bg-gold/[0.06] px-4 py-3 shadow-[0_0_24px_rgba(201,153,46,0.10)] sm:max-w-[85%]">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="font-label flex items-center gap-1 text-[10px] text-gold-deep">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Agron
            </span>
            <span className="font-label text-[10px] text-ink-soft/50">{time}</span>
          </div>
          {message.text && <Markdown text={message.text} />}
          <Attachment message={message} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('my-1 flex', own ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2 sm:max-w-[75%]',
          own
            ? 'rounded-br-sm border border-gold/40 bg-gold/15'
            : 'rounded-bl-sm border border-sand bg-paper',
        )}
      >
        {!own && (
          <div
            className={cn(
              'font-label mb-0.5 text-[9px]',
              message.sender_role === 'teacher' ? 'text-gold-deep' : 'text-sage-deep',
            )}
          >
            {SENDER_LABEL[message.sender_role]}
          </div>
        )}
        {message.text && <Markdown text={message.text} />}
        <Attachment message={message} />
        <div className="font-label mt-1 flex items-center justify-end gap-1 text-[9px] text-ink-soft/60">
          <span>{time}</span>
          {own && <Ticks status={message.status} />}
        </div>
      </div>
    </div>
  );
}
