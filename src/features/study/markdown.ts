import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Render AI-generated markdown to sanitized HTML (contract §7).
 * marked parses, DOMPurify strips anything dangerous before it hits the DOM.
 */
export function renderMarkdown(markdown: string): string {
  const raw = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(raw);
}

/**
 * Tailwind classes that style raw markdown HTML (h1-h4, lists, code, tables…)
 * via arbitrary descendant selectors — no typography plugin needed.
 * `notranslate` keeps the Google Translate widget away from technical
 * AI content (contract §15).
 */
export const markdownClass = [
  'notranslate',
  'text-sm leading-relaxed text-ink-soft',
  '[&_h1]:font-display [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-ink',
  '[&_h2]:font-display [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink',
  '[&_h3]:font-display [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink',
  '[&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-ink',
  '[&_p]:my-2',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-1 [&_li]:marker:text-gold',
  '[&_strong]:text-ink [&_em]:text-ink',
  '[&_a]:text-gold-deep [&_a]:underline',
  '[&_code]:rounded [&_code]:bg-ivory-deep [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-gold-deep [&_code]:notranslate',
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-sand [&_pre]:bg-ivory-deep [&_pre]:p-3 [&_pre]:notranslate',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-gold/50 [&_blockquote]:pl-3 [&_blockquote]:text-ink-soft',
  '[&_hr]:my-4 [&_hr]:border-sand',
  '[&_table]:my-2 [&_table]:w-full [&_table]:text-left [&_th]:border-b [&_th]:border-sand-deep [&_th]:py-1 [&_th]:pr-3 [&_th]:text-ink [&_td]:border-b [&_td]:border-sand [&_td]:py-1 [&_td]:pr-3',
].join(' ');
