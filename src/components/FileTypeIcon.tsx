import {
  File,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Presentation,
  ScrollText,
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface FileTypeIconProps {
  /** MIME type or file name to base the icon on. */
  type?: string | null;
  className?: string;
}

/**
 * Lucide icon for a file type or file name (icon policy, contract §12 —
 * replaces the old emoji hints; pure presentation).
 */
export default function FileTypeIcon({ type, className }: FileTypeIconProps) {
  const t = (type ?? '').toLowerCase();
  const cls = cn('h-4 w-4 shrink-0 text-gold', className);
  if (t.includes('ppt') || t.includes('presentation') || t.includes('slide')) {
    return <Presentation className={cls} aria-hidden="true" />;
  }
  if (t.includes('image') || /\.(png|jpe?g|gif|webp|svg)$/.test(t)) {
    return <FileImage className={cls} aria-hidden="true" />;
  }
  if (t.includes('audio') || /\.(mp3|wav|webm|m4a|ogg)$/.test(t)) {
    return <FileAudio className={cls} aria-hidden="true" />;
  }
  if (t.includes('video') || /\.(mp4|mov)$/.test(t)) {
    return <FileVideo className={cls} aria-hidden="true" />;
  }
  if (t.includes('markdown') || /\.md$/.test(t)) {
    return <ScrollText className={cls} aria-hidden="true" />;
  }
  if (t.includes('pdf') || t.includes('doc') || t.includes('word') || t.includes('text') || /\.txt$/.test(t)) {
    return <FileText className={cls} aria-hidden="true" />;
  }
  return <File className={cls} aria-hidden="true" />;
}
