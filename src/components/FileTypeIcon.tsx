import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
} from 'lucide-react';

type Props = {
  type: string | null;
  className?: string;
};

/** Maps a MIME type or file name to a representative Lucide icon. */
export default function FileTypeIcon({ type, className = 'h-5 w-5' }: Props) {
  const t = (type || '').toLowerCase();
  let Icon = FileIcon;
  if (t.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(t)) Icon = FileImage;
  else if (t.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/.test(t)) Icon = FileVideo;
  else if (t.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/.test(t)) Icon = FileAudio;
  else if (t.includes('pdf') || t.endsWith('.pdf')) Icon = FileText;
  else if (t.includes('sheet') || t.includes('excel') || /\.(xlsx?|csv)$/.test(t)) Icon = FileSpreadsheet;
  else if (t.includes('zip') || /\.(zip|rar|7z|tar|gz)$/.test(t)) Icon = FileArchive;
  else if (t.includes('json') || t.includes('javascript') || /\.(ts|tsx|js|jsx|py|java|cs|html|css)$/.test(t)) Icon = FileCode;
  else if (t.startsWith('text/') || /\.(docx?|txt|md|pptx?)$/.test(t)) Icon = FileText;
  return <Icon className={className} aria-hidden="true" />;
}
