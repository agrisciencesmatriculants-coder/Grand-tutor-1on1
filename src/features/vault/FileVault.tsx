import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Download, FolderOpen, Mic, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import type { FileRow, Profile } from '../../lib/types';
import { cn, formatBytes, formatDate, safeUrl } from '../../lib/utils';
import FileTypeIcon from '../../components/FileTypeIcon';

const BUCKET = 'files';
const MAX_BYTES = 25 * 1024 * 1024; // contract §7: max 25MB
const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'docx',
  'pptx',
  'txt',
  'md',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'mp3',
  'wav',
  'm4a',
  'ogg',
  'webm',
]);

type Filter = 'all' | 'mine' | 'teacher' | 'agron';
type PreviewKind = 'image' | 'pdf' | 'audio' | 'other';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
  { id: 'teacher', label: "Teacher's" },
  { id: 'agron', label: 'Agron-ready' },
];

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

/** contract §7: allow pdf/docx/pptx/txt/md/images/audio, max 25MB. */
function validateFile(file: File): string | null {
  if (file.size > MAX_BYTES) return `"${file.name}" is over the 25MB limit.`;
  const ext = extensionOf(file.name);
  const mimeOk = file.type.startsWith('image/') || file.type.startsWith('audio/');
  if (!ALLOWED_EXTENSIONS.has(ext) && !mimeOk) {
    return `"${file.name}" — only pdf, docx, pptx, txt, md, images and audio are allowed.`;
  }
  return null;
}

function previewKindOf(file: FileRow): PreviewKind {
  const t = (file.file_type ?? '').toLowerCase();
  const ext = extensionOf(file.file_name ?? '');
  if (t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (t.includes('pdf') || ext === 'pdf') return 'pdf';
  if (t.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg', 'webm'].includes(ext)) return 'audio';
  return 'other';
}

/** Shared learning-material vault: upload, list, preview, download, delete. */
export default function FileVault() {
  const { profile, role } = useAuth();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Pick<Profile, 'full_name' | 'role'>>>(new Map());
  const [subject, setSubject] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [preview, setPreview] = useState<FileRow | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) {
      setError(`Could not load the vault: ${err.message}`);
    } else {
      setFiles((data ?? []) as FileRow[]);
    }
    setLoading(false);
  }, []);

  const fetchProfiles = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('profiles').select('id, full_name, role');
    const map = new Map<string, Pick<Profile, 'full_name' | 'role'>>();
    for (const p of (data ?? []) as Array<Pick<Profile, 'id' | 'full_name' | 'role'>>) {
      map.set(p.id, { full_name: p.full_name, role: p.role });
    }
    setProfiles(map);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;
    void fetchFiles();
    void fetchProfiles();

    const channel = client
      .channel('vault-files')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'files' },
        (payload) => {
          const row = payload.new as FileRow;
          setFiles((prev) => (prev.some((f) => f.id === row.id) ? prev : [row, ...prev]));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'files' },
        (payload) => {
          const row = payload.new as FileRow;
          setFiles((prev) => prev.map((f) => (f.id === row.id ? row : f)));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'files' },
        (payload) => {
          const oldId = (payload.old as Partial<FileRow>).id;
          setFiles((prev) => prev.filter((f) => f.id !== oldId));
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [fetchFiles, fetchProfiles]);

  const uploadFiles = useCallback(
    async (incoming: Iterable<File>) => {
      if (!supabase || !profile) return;
      setError(null);
      const trimmedSubject = subject.trim();
      for (const file of Array.from(incoming)) {
        const problem = validateFile(file);
        if (problem) {
          setError(problem);
          continue;
        }
        setUploading(true);
        const storagePath = `vault/${Date.now()}_${sanitizeName(file.name)}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file);
        if (upErr) {
          setError(`Upload failed for "${file.name}": ${upErr.message}`);
          continue;
        }
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        const { data: inserted, error: insErr } = await supabase
          .from('files')
          .insert({
            uploader_id: profile.id,
            file_name: file.name,
            file_url: pub.publicUrl,
            storage_path: storagePath,
            file_type: file.type || extensionOf(file.name),
            size_bytes: file.size,
            subject: trimmedSubject || null,
          })
          .select('id')
          .single();
        if (insErr) {
          setError(`Could not register "${file.name}": ${insErr.message}`);
          continue;
        }
        // Fire-and-forget so Agron can read it later (contract §6).
        if (inserted?.id) {
          void supabase.functions.invoke('extract-file-text', { body: { fileId: inserted.id } });
        }
      }
      setUploading(false);
      // Refresh in case realtime for `files` is not enabled on the project.
      await fetchFiles();
    },
    [profile, subject, fetchFiles],
  );

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void uploadFiles(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
  };

  const deleteFile = async (file: FileRow) => {
    if (!supabase) return;
    setError(null);
    if (file.storage_path) {
      const { error: storageErr } = await supabase.storage.from(BUCKET).remove([file.storage_path]);
      if (storageErr) {
        setError(`Could not remove "${file.file_name}" from storage: ${storageErr.message}`);
        return;
      }
    }
    const { error: delErr } = await supabase.from('files').delete().eq('id', file.id);
    if (delErr) {
      setError(`Could not delete "${file.file_name}": ${delErr.message}`);
      return;
    }
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    if (preview?.id === file.id) setPreview(null);
  };

  const visibleFiles = useMemo(() => {
    switch (filter) {
      case 'mine':
        return files.filter((f) => f.uploader_id === profile?.id);
      case 'teacher':
        return files.filter((f) => f.uploader_id && profiles.get(f.uploader_id)?.role === 'teacher');
      case 'agron':
        return files.filter((f) => !!f.extracted_text);
      default:
        return files;
    }
  }, [files, filter, profile?.id, profiles]);

  const uploaderName = (file: FileRow): string => {
    if (!file.uploader_id) return 'Unknown';
    if (file.uploader_id === profile?.id) return 'You';
    return profiles.get(file.uploader_id)?.full_name?.trim() || 'Cast member';
  };

  const canDelete = (file: FileRow): boolean =>
    role === 'teacher' || file.uploader_id === profile?.id;

  const previewUrl = preview ? safeUrl(preview.file_url) : null;

  if (!supabase) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-cream-dim">The vault opens once Supabase is configured.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <h2 className="font-label flex items-center gap-1.5 text-[11px] text-gold-dim">
          <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
          File Vault
        </h2>
        {uploading && <span className="font-label text-[10px] text-gold-light">Uploading…</span>}
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files to the vault"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'cursor-pointer rounded-lg border border-dashed px-3 py-4 text-center transition',
          dragging
            ? 'border-gold bg-gold/15'
            : 'border-gold/30 bg-stage-deep/60 hover:border-gold/60 hover:bg-gold/5',
        )}
      >
        <p className="text-sm text-gold-light">Drop files here, or click to browse</p>
        <p className="mt-1 text-[11px] text-cream-dim/70">
          pdf · docx · pptx · txt · md · images · audio — max 25MB
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onInputChange}
          accept=".pdf,.docx,.pptx,.txt,.md,image/*,audio/*"
        />
      </div>

      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject tag for uploads (optional)"
        className="input-stage mt-2 py-1.5 text-xs"
        aria-label="Subject tag for uploads"
      />

      {error && (
        <p className="mt-2 rounded-md border border-crimson/50 bg-crimson/10 px-2 py-1.5 text-xs text-crimson-light">
          {error}
        </p>
      )}

      {/* Filter chips */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Vault filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'font-label rounded-full border px-2.5 py-1 text-[10px] transition',
              filter === f.id
                ? 'border-gold/70 bg-gold/15 text-gold-light'
                : 'border-gold/20 text-cream-dim hover:border-gold/40 hover:text-cream',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* File list */}
      <div className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {loading ? (
          <p className="px-1 py-4 text-center text-xs text-cream-dim">Raising the curtain…</p>
        ) : visibleFiles.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-cream-dim">
            The vault is empty — share the first prop.
          </p>
        ) : (
          visibleFiles.map((file) => (
            <div
              key={file.id}
              className="group flex items-center gap-2 rounded-lg border border-gold/15 bg-stage-panel/70 px-2.5 py-2 transition hover:border-gold/40"
            >
              <button
                type="button"
                onClick={() => setPreview(file)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                title={`Preview ${file.file_name ?? 'file'}`}
              >
                <FileTypeIcon type={file.file_type ?? file.file_name} className="h-5 w-5" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm text-cream">{file.file_name ?? 'Untitled'}</span>
                    {file.extracted_text && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold shadow-[0_0_6px_rgba(232,179,75,0.9)]"
                        title="Agron-ready"
                        aria-label="Agron-ready"
                      />
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-cream-dim/80">
                    {formatBytes(file.size_bytes)} · {uploaderName(file)} · {formatDate(file.created_at)}
                    {file.subject ? ` · ${file.subject}` : ''}
                  </span>
                </span>
              </button>
              {canDelete(file) && (
                <button
                  type="button"
                  onClick={() => void deleteFile(file)}
                  className="shrink-0 rounded p-1 text-cream-dim/60 opacity-0 transition hover:bg-crimson/20 hover:text-crimson-light group-hover:opacity-100"
                  aria-label={`Delete ${file.file_name ?? 'file'}`}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stage-deep/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${preview.file_name ?? 'file'}`}
          onClick={() => setPreview(null)}
        >
          <div
            className="card-playbill flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-gold/20 px-4 py-3">
              <p className="flex min-w-0 items-center gap-2 text-sm text-cream">
                <FileTypeIcon type={preview.file_type ?? preview.file_name} />
                <span className="truncate">{preview.file_name ?? 'Untitled'}</span>
              </p>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="btn-ghost px-2.5 py-1 text-xs"
                aria-label="Close preview"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {previewKindOf(preview) === 'image' && previewUrl && (
                <img
                  src={previewUrl}
                  alt={preview.file_name ?? 'Preview'}
                  className="mx-auto max-h-[65vh] rounded-lg object-contain"
                />
              )}
              {previewKindOf(preview) === 'pdf' && previewUrl && (
                <iframe
                  src={previewUrl}
                  title={preview.file_name ?? 'PDF preview'}
                  className="h-[65vh] w-full rounded-lg border border-gold/20 bg-white"
                />
              )}
              {previewKindOf(preview) === 'audio' && previewUrl && (
                <div className="spotlight-tight flex flex-col items-center gap-4 rounded-lg py-10">
                  <Mic className="h-10 w-10 text-gold" aria-hidden="true" />
                  <audio controls src={previewUrl} className="w-full max-w-md">
                    Your browser cannot play this audio.
                  </audio>
                </div>
              )}
              {previewKindOf(preview) === 'other' && (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <FileTypeIcon type={preview.file_type ?? preview.file_name} className="h-10 w-10" />
                  <p className="text-sm text-cream-dim">
                    No on-stage preview for this file type — download it to take a look.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gold/20 px-4 py-3">
              <p className="text-[11px] text-cream-dim/80">
                {formatBytes(preview.size_bytes)} · {uploaderName(preview)}
              </p>
              {previewUrl ? (
                <a
                  href={previewUrl}
                  download={preview.file_name ?? true}
                  className="btn-gold px-3 py-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Download
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="btn-gold cursor-not-allowed px-3 py-1.5 text-xs opacity-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Download
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
