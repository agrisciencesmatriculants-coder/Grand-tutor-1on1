import { memo, useMemo } from 'react';
import { markdownClass, renderMarkdown } from './markdown';

export interface MarkdownBlockProps {
  markdown: string;
  className?: string;
}

/**
 * Memoized, sanitized AI-markdown block (contract §7 + §13 perf): the
 * marked→DOMPurify pipeline only re-runs when the source text changes.
 * Marked `notranslate` so the Google Translate widget never mangles
 * technical/AI content (contract §15).
 */
function MarkdownBlockInner({ markdown, className }: MarkdownBlockProps) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);
  return (
    <div
      className={className ? `${markdownClass} ${className}` : markdownClass}
      translate="no"
      // Sanitized by DOMPurify inside renderMarkdown (contract §7).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const MarkdownBlock = memo(MarkdownBlockInner);
export default MarkdownBlock;
