import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Loader2, MessagesSquare, Paperclip, Radio, Send, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AI_NAME, useAuth } from '../../lib/auth';
import { useLanguage } from '../../lib/language';
import type { Message } from '../../lib/types';
import { formatDate } from '../../lib/utils';
import MessageBubble from './MessageBubble';
import VoiceNoteButton from './VoiceNoteButton';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // contract §7
const TYPING_THROTTLE_MS = 2000;
const TYPING_VISIBLE_MS = 3000;
const AI_TIMEOUT_MS = 60_000;

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-() ]/g, '_');
}

/** Ephemeral centred "Agron is thinking…" bubble with animated ellipsis. */
function ThinkingBubble() {
  return (
    <div className="my-2 flex justify-center">
      <div className="rounded-xl border border-dashed border-gold/50 bg-ivory-deep px-4 py-2.5">
        <span className="font-label flex items-center gap-1 text-[10px] text-gold-deep">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {AI_NAME} is thinking
          <span className="inline-flex">
            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>
              .
            </span>
            <span className="animate-bounce" style={{ animationDelay: '150ms' }}>
              .
            </span>
            <span className="animate-bounce" style={{ animationDelay: '300ms' }}>
              .
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * WhatsApp-style realtime chat between George (teacher), Kelebogile (student)
 * and Agron (AI). Reads identity from useAuth; no props.
 */
export default function ChatPanel() {
  const { profile, role } = useAuth();
  const { lang } = useLanguage();
  const myId = profile?.id ?? null;
  const myName =
    profile?.full_name?.trim() || (role === 'teacher' ? 'George' : 'Kelebogile');

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [typingName, setTypingName] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const visibleRef = useRef(true);
  const lastTypingSentRef = useRef(0);
  const typingTimeoutRef = useRef<number | null>(null);
  const aiErrorTimeoutRef = useRef<number | null>(null);
  const thinkingTimeoutRef = useRef<number | null>(null);

  /** Batch read-receipt: mark every incoming human message as read (contract §6). */
  const markIncomingRead = useCallback(async () => {
    if (!supabase || !myId) return;
    const { error: err } = await supabase
      .from('messages')
      .update({ status: 'read' })
      .neq('sender_role', 'ai')
      .neq('sender_id', myId)
      .neq('status', 'read');
    if (err) console.error('Failed to mark messages read:', err.message);
  }, [myId]);

  const showAiError = useCallback((message: string) => {
    setAiError(message);
    if (aiErrorTimeoutRef.current !== null) window.clearTimeout(aiErrorTimeoutRef.current);
    aiErrorTimeoutRef.current = window.setTimeout(() => setAiError(null), 6000);
  }, []);

  const clearThinking = useCallback(() => {
    setThinking(false);
    if (thinkingTimeoutRef.current !== null) {
      window.clearTimeout(thinkingTimeoutRef.current);
      thinkingTimeoutRef.current = null;
    }
  }, []);

  /* ---- Initial load (last 100, ascending) + realtime subscriptions ---- */
  useEffect(() => {
    if (!supabase || !myId) {
      setLoading(false);
      return;
    }
    const client = supabase; // narrowed non-null for use inside callbacks
    let cancelled = false;

    const load = async () => {
      const { data, error: err } = await client
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (err) {
        setError('Could not load the conversation. Please refresh the page.');
        setLoading(false);
        return;
      }
      setMessages(((data ?? []) as Message[]).reverse());
      setLoading(false);
      void markIncomingRead();
    };
    void load();

    const channel = client
      .channel('chat-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.sender_role === 'ai') {
            clearThinking();
            return;
          }
          if (!msg.sender_id || msg.sender_id === myId) return;
          // Receipts for the other human's message: read if we're watching, else delivered.
          if (visibleRef.current) {
            void markIncomingRead();
          } else {
            void client
              .from('messages')
              .update({ status: 'delivered' })
              .eq('id', msg.id)
              .eq('status', 'sent');
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
        },
      )
      .subscribe();

    const typingChannel = client
      .channel('typing')
      .on('broadcast', { event: 'typing' }, (event) => {
        const payload = event.payload as { userId?: string; name?: string } | undefined;
        if (!payload?.userId || payload.userId === myId) return;
        setTypingName(payload.name ?? 'Someone');
        if (typingTimeoutRef.current !== null) window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = window.setTimeout(() => setTypingName(null), TYPING_VISIBLE_MS);
      })
      .subscribe();
    typingChannelRef.current = typingChannel;

    return () => {
      cancelled = true;
      typingChannelRef.current = null;
      if (typingTimeoutRef.current !== null) window.clearTimeout(typingTimeoutRef.current);
      void client.removeChannel(channel);
      void client.removeChannel(typingChannel);
    };
  }, [myId, markIncomingRead, clearThinking]);

  /* ---- Visibility / focus → send read receipts ---- */
  useEffect(() => {
    const refresh = () => {
      visibleRef.current = document.visibilityState === 'visible' && document.hasFocus();
      if (visibleRef.current) void markIncomingRead();
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('blur', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('blur', refresh);
    };
  }, [markIncomingRead]);

  /* ---- Auto-scroll to bottom on new activity ---- */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, thinking, typingName]);

  /* ---- Cleanup pending timers on unmount ---- */
  useEffect(
    () => () => {
      if (aiErrorTimeoutRef.current !== null) window.clearTimeout(aiErrorTimeoutRef.current);
      if (thinkingTimeoutRef.current !== null) window.clearTimeout(thinkingTimeoutRef.current);
    },
    [],
  );

  const sendTypingSignal = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    const channel = typingChannelRef.current;
    if (!channel || !myId) return;
    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: myId, name: myName },
    });
  }, [myId, myName]);

  const autogrow = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  };

  const appendIfNew = (msg: Message) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  };

  /* ---- Send a text message (+ optional @ai invocation) ---- */
  const send = async () => {
    const text = draft.trim();
    if (!text || !supabase || !myId || !role || sending || uploading) return;
    setSending(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('messages')
      .insert({ sender_id: myId, sender_role: role, text })
      .select()
      .single();
    setSending(false);
    if (err) {
      setError('Message failed to send. Please try again.');
      return;
    }
    if (data) appendIfNew(data as Message);
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    if (/@ai/i.test(text)) {
      setThinking(true);
      if (thinkingTimeoutRef.current !== null) window.clearTimeout(thinkingTimeoutRef.current);
      thinkingTimeoutRef.current = window.setTimeout(() => {
        clearThinking();
        showAiError(`${AI_NAME} did not respond — please try again.`);
      }, AI_TIMEOUT_MS);
      const { error: fnErr } = await supabase.functions.invoke('ask-ai', {
        body: { message: text, language: lang },
      });
      if (fnErr) {
        clearThinking();
        showAiError(`${AI_NAME} did not respond — please try again in a moment.`);
      }
      // On success the AI reply arrives as a realtime INSERT and dismisses the bubble.
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  /* ---- File attach ---- */
  const onFilePicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !supabase || !myId || !role) return;
    if (file.size > MAX_FILE_SIZE) {
      setError('That file is too large — the limit is 25MB.');
      return;
    }
    setUploading(true);
    setError(null);
    const path = `chat/${Date.now()}_${sanitizeFileName(file.name)}`;
    const { error: upErr } = await supabase.storage.from('files').upload(path, file);
    if (upErr) {
      setUploading(false);
      setError('Upload failed. Please try again.');
      return;
    }
    const { data: urlData } = supabase.storage.from('files').getPublicUrl(path);
    const { data, error: insErr } = await supabase
      .from('messages')
      .insert({
        sender_id: myId,
        sender_role: role,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.type || null,
      })
      .select()
      .single();
    setUploading(false);
    if (insErr) {
      setError('File uploaded, but the message could not be sent.');
      return;
    }
    if (data) appendIfNew(data as Message);
  };

  /* ---- Voice note ---- */
  const onVoiceRecorded = async (blob: Blob) => {
    if (!supabase || !myId || !role) return;
    setUploading(true);
    setError(null);
    const path = `voice/${Date.now()}.webm`;
    const { error: upErr } = await supabase.storage
      .from('files')
      .upload(path, blob, { contentType: 'audio/webm' });
    if (upErr) {
      setUploading(false);
      setError('Voice note failed to upload. Please try again.');
      return;
    }
    const { data: urlData } = supabase.storage.from('files').getPublicUrl(path);
    const { data, error: insErr } = await supabase
      .from('messages')
      .insert({ sender_id: myId, sender_role: role, audio_url: urlData.publicUrl })
      .select()
      .single();
    setUploading(false);
    if (insErr) {
      setError('Voice note uploaded, but the message could not be sent.');
      return;
    }
    if (data) appendIfNew(data as Message);
  };

  /* ---- Render guards ---- */
  if (!supabase) {
    return (
      <div className="card-playbill p-4 text-sm text-ink-soft">
        Chat is unavailable until Supabase is configured.
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="card-playbill p-4 text-sm text-ink-soft">
        Please sign in to use the chat.
      </div>
    );
  }

  return (
    <div className="card-playbill relative flex h-full min-h-[30rem] flex-col overflow-hidden">
      <div className="spotlight" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-sand px-4 py-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Classroom Chat</h2>
          <p className="font-label text-[9px] text-ink-soft/70">
            George · Kelebogile · {AI_NAME} — mention @ai for the tutor
          </p>
        </div>
        <span className="font-label hidden items-center gap-1 text-[9px] text-terra-deep sm:flex">
          <Radio className="h-3 w-3" aria-hidden="true" />
          LIVE
        </span>
      </div>

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        {loading ? (
          <p className="font-display py-10 text-center text-sm text-ink-soft">
            Loading messages…
          </p>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 px-6 text-center">
            <img
              src="/assets/empty-stage.png"
              alt=""
              className="h-32 w-32 rounded-full border border-sand object-cover opacity-90"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <p className="font-display flex items-center gap-2 text-lg text-ink">
              <MessagesSquare className="h-5 w-5 text-gold" aria-hidden="true" />
              No messages yet
            </p>
            <p className="max-w-xs text-xs text-ink-soft">
              Start the conversation with George, Kelebogile and {AI_NAME}.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const showSeparator =
              index === 0 || !sameDay(messages[index - 1].created_at, message.created_at);
            return (
              <Fragment key={message.id}>
                {showSeparator && (
                  <div className="my-3 flex items-center gap-3">
                    <span className="h-px flex-1 bg-sand" />
                    <span className="font-label text-[9px] text-ink-soft/70">
                      {formatDate(message.created_at)}
                    </span>
                    <span className="h-px flex-1 bg-sand" />
                  </div>
                )}
                <MessageBubble
                  message={message}
                  own={message.sender_id !== null && message.sender_id === myId}
                />
              </Fragment>
            );
          })
        )}

        {thinking && <ThinkingBubble />}

        {aiError && (
          <p className="my-2 text-center font-label text-[10px] normal-case text-terra-deep">
            {aiError}
          </p>
        )}

        {typingName && (
          <p className="font-label mt-1 text-[10px] normal-case text-ink-soft/80">
            {typingName} is typing…
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Inline error */}
      {error && (
        <p className="relative z-10 border-t border-terra/40 bg-terra-tint px-4 py-1.5 text-center text-xs text-terra-deep">
          {error}
        </p>
      )}

      {/* Composer */}
      <form
        className="relative z-10 border-t border-sand bg-ivory-deep px-3 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => void onFilePicked(e)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Attach a file"
            title="Attach a file"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-sm text-gold-deep transition hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              sendTypingSignal();
              autogrow();
            }}
            onKeyDown={onKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
            className="input-stage max-h-[120px] flex-1 resize-none overflow-y-auto py-2"
          />

          <VoiceNoteButton
            onRecorded={(blob) => void onVoiceRecorded(blob)}
            onError={setError}
            disabled={uploading}
          />

          <button
            type="submit"
            disabled={!draft.trim() || sending || uploading}
            aria-label="Send message"
            className="btn-gold h-9 w-9 shrink-0 rounded-full p-0"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
