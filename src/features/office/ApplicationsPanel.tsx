import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardList,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import type { ScreeningTestFull, SectionVerdict, TutorApplication, TutorDocument } from '../../lib/types';

const SECTION_KEYS = ['motivation', 'subjects', 'availability', 'video', 'id_document', 'transcript'] as const;

const SECTION_LABELS: Record<string, string> = {
  motivation: 'Motivation',
  subjects: 'Subjects & levels',
  availability: 'Availability',
  video: 'Intro video',
  id_document: 'ID document',
  transcript: 'Transcript',
};

const STATUS_STYLES: Record<string, string> = {
  submitted: 'border-gold/40 bg-gold/10 text-ink',
  in_review: 'border-gold/40 bg-gold/10 text-ink',
  approved: 'border-sage/50 bg-sage/10 text-sage-deep',
  rejected: 'border-terra/40 bg-terra/5 text-terra',
  draft: 'border-sand bg-neutral-50 text-ink-soft',
};

function verdictOf(app: TutorApplication, key: string): SectionVerdict {
  return app.section_status?.[key] ?? 'pending';
}

/** Applications tab: screening queue + full reviewer workspace. */
export default function ApplicationsPanel({
  onChanged,
  setError,
  setNotice,
}: {
  onChanged: () => Promise<void>;
  setError: (e: string | null) => void;
  setNotice: (n: string | null) => void;
}) {
  const [apps, setApps] = useState<TutorApplication[]>([]);
  const [allTests, setAllTests] = useState<ScreeningTestFull[]>([]);
  const [selected, setSelected] = useState<TutorApplication | null>(null);
  const [docs, setDocs] = useState<TutorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [prescreening, setPrescreening] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [docReasons, setDocReasons] = useState<Record<string, string>>({});
  const [sectionNotes, setSectionNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('tutor_applications')
      .select('*, profiles:user_id(full_name, email)')
      .order('submitted_at', { ascending: false, nullsFirst: false });
    if (error) setError(error.message);
    setApps((data as TutorApplication[]) ?? []);
    const { data: t } = await supabase
      .from('screening_tests')
      .select('*')
      .order('created_at', { ascending: true });
    setAllTests((t as ScreeningTestFull[]) ?? []);
    setLoading(false);
  }, [setError]);

  useEffect(() => {
    void load();
  }, [load]);

  const openApplication = useCallback(async (a: TutorApplication) => {
    setSelected(a);
    setRejectReason('');
    setSectionNotes(a.section_notes ?? {});
    if (!supabase) return;
    const { data } = await supabase
      .from('tutor_documents')
      .select('*')
      .eq('application_id', a.id)
      .order('created_at', { ascending: false });
    setDocs(((data as TutorDocument[]) ?? []).filter((d) => d.status !== 'superseded'));
  }, []);

  const runPrescreen = async () => {
    if (!supabase || !selected) return;
    setPrescreening(true);
    try {
      const { data, error } = await supabase.functions.invoke('prescreen-application', {
        body: { application_id: selected.id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setSelected({ ...selected, ai_score: data.ai_score, ai_summary: data.ai_summary });
      setNotice('AI pre-screen complete.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI pre-screen failed.');
    } finally {
      setPrescreening(false);
    }
  };

  const setVerdict = async (key: string, verdict: SectionVerdict) => {
    if (!supabase || !selected) return;
    const section_status = { ...(selected.section_status ?? {}), [key]: verdict };
    const section_notes = { ...(selected.section_notes ?? {}), [key]: sectionNotes[key] ?? '' };
    const { error } = await supabase
      .from('tutor_applications')
      .update({ section_status, section_notes, status: 'in_review' })
      .eq('id', selected.id);
    if (error) setError(error.message);
    else setSelected({ ...selected, section_status, section_notes, status: 'in_review' });
  };

  const reviewDocument = async (doc: TutorDocument, verdict: 'approved' | 'rejected') => {
    if (!supabase) return;
    const reason = docReasons[doc.id]?.trim() ?? '';
    if (verdict === 'rejected' && !reason) {
      setError('Give a reason when rejecting a document, so the applicant knows what to fix.');
      return;
    }
    const { error } = await supabase
      .from('tutor_documents')
      .update({ status: verdict, reject_reason: verdict === 'rejected' ? reason : null })
      .eq('id', doc.id);
    if (error) setError(error.message);
    else {
      setDocs((cur) => cur.map((d) => (d.id === doc.id ? { ...d, status: verdict, reject_reason: reason || null } : d)));
      setNotice(verdict === 'approved' ? 'Document approved.' : 'Document rejected — the applicant can upload a replacement.');
    }
  };

  const viewDocument = async (doc: TutorDocument) => {
    if (!supabase) return;
    const { data, error } = await supabase.storage.from('tutor-docs').createSignedUrl(doc.file_path, 300);
    if (error || !data?.signedUrl) setError(error?.message ?? 'Could not open document.');
    else window.open(data.signedUrl, '_blank', 'noopener');
  };

  const finalVerdict = async (action: 'approve' | 'reject') => {
    if (!supabase || !selected) return;
    if (action === 'reject' && !rejectReason.trim()) {
      setError('A reason is required when rejecting an application.');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('review-application', {
        body: { application_id: selected.id, action, reason: rejectReason.trim() || undefined },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setNotice(action === 'approve' ? 'Application approved — tutor notified by email.' : 'Application rejected — the applicant can fix and resubmit.');
      setSelected(null);
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-ink-soft">Loading applications…</p>;

  const queue = apps.filter((a) => a.status === 'submitted' || a.status === 'in_review');

  // ---------------- Detail workspace ----------------
  if (selected) {
    const a = selected;
    const applicant = a.profiles;
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setSelected(null)}>
            Back to queue
          </button>
          <h2 className="text-lg font-semibold text-ink">{applicant?.full_name ?? 'Applicant'}</h2>
          <span className="text-xs text-ink-soft">{applicant?.email}</span>
          <span className={cn('border px-2 py-0.5 text-xs font-semibold capitalize', STATUS_STYLES[a.status])}>
            {a.status.replace('_', ' ')}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Written sections */}
          <section className="card-playbill p-5">
            <h3 className="font-semibold text-ink">Written application</h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-ink">Province &amp; languages</dt>
                <dd className="text-ink-soft">
                  {a.about?.province ?? '—'} · {(a.about?.languages ?? []).join(', ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Why they want to tutor</dt>
                <dd className="whitespace-pre-wrap text-ink-soft">{a.motivation?.why_tutor ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Experience</dt>
                <dd className="whitespace-pre-wrap text-ink-soft">{a.motivation?.experience ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Subjects</dt>
                <dd className="text-ink-soft">
                  {(a.subjects?.highschool ?? []).map((s) => `${s} (HS)`).concat((a.subjects?.varsity ?? []).map((s) => `${s} (Varsity)`)).join(', ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Intro video</dt>
                <dd>
                  {a.video_url ? (
                    <a href={a.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gold-deep underline">
                      Watch video <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="text-ink-soft">—</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* AI pre-screen + subject test */}
          <section className="space-y-4">
            <div className="card-playbill p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold text-ink">
                  <Sparkles className="h-4 w-4 text-gold-deep" aria-hidden="true" /> AI pre-screen
                </h3>
                <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={prescreening} onClick={() => void runPrescreen()}>
                  {prescreening ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : a.ai_score != null ? 'Re-run' : 'Run AI pre-screen'}
                </button>
              </div>
              {a.ai_score != null ? (
                <div className="mt-3">
                  <p className={cn('text-2xl font-bold', a.ai_score >= 70 ? 'text-sage-deep' : a.ai_score >= 40 ? 'text-gold-deep' : 'text-terra-deep')}>
                    {a.ai_score}/100
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{a.ai_summary}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">Not run yet. The AI summarises effort and flags copy-pasted or vague answers — you still make the final call.</p>
              )}
            </div>

            <TestScoresPanel applicationId={a.id} setError={setError} setNotice={setNotice} />

            {/* Documents */}
            <div className="card-playbill p-5">
              <h3 className="font-semibold text-ink">Documents</h3>
              {docs.length === 0 && <p className="mt-2 text-sm text-ink-soft">None uploaded.</p>}
              <ul className="mt-3 space-y-3">
                {docs.map((d) => (
                  <li key={d.id} className="border border-sand p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        <FileText className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                        {SECTION_LABELS[d.kind]} <span className="text-xs text-ink-soft">v{d.version}</span>
                      </span>
                      <span className={cn('border px-2 py-0.5 text-xs font-medium capitalize', STATUS_STYLES[d.status] ?? STATUS_STYLES.draft)}>
                        {d.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" className="btn-ghost flex items-center gap-1 px-2.5 py-1 text-xs" onClick={() => void viewDocument(d)}>
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" /> View
                      </button>
                      {d.status !== 'approved' && (
                        <button type="button" className="btn-ghost flex items-center gap-1 px-2.5 py-1 text-xs text-sage-deep" onClick={() => void reviewDocument(d, 'approved')}>
                          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /> Accept
                        </button>
                      )}
                      {d.status !== 'rejected' && (
                        <span className="flex items-center gap-1">
                          <input
                            className="input-stage w-40 px-2 py-1 text-xs"
                            placeholder="Reason if rejecting"
                            value={docReasons[d.id] ?? ''}
                            onChange={(e) => setDocReasons((cur) => ({ ...cur, [d.id]: e.target.value }))}
                          />
                          <button type="button" className="btn-ghost flex items-center gap-1 px-2.5 py-1 text-xs text-terra-deep" onClick={() => void reviewDocument(d, 'rejected')}>
                            <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" /> Reject
                          </button>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        {/* Per-section verdicts */}
        <section className="card-playbill p-5">
          <h3 className="font-semibold text-ink">Section verdicts</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Flag exactly what needs fixing — the applicant sees these notes and only has to repair the
            flagged sections.
          </p>
          <div className="mt-3 space-y-2">
            {SECTION_KEYS.map((key) => {
              const v = verdictOf(a, key);
              return (
                <div key={key} className="flex flex-wrap items-center gap-2 border-b border-sand pb-2 text-sm">
                  <span className="w-40 font-medium text-ink">{SECTION_LABELS[key]}</span>
                  <span
                    className={cn(
                      'border px-2 py-0.5 text-xs font-medium',
                      v === 'approved' && 'border-sage/50 bg-sage/10 text-sage-deep',
                      v === 'pending' && 'border-sand bg-neutral-50 text-ink-soft',
                      v === 'needs_fix' && 'border-terra/40 bg-terra/5 text-terra',
                    )}
                  >
                    {v === 'needs_fix' ? 'needs fix' : v}
                  </span>
                  <input
                    className="input-stage min-w-0 flex-1 px-2 py-1 text-xs"
                    placeholder="Note to applicant (optional)"
                    value={sectionNotes[key] ?? ''}
                    onChange={(e) => setSectionNotes((cur) => ({ ...cur, [key]: e.target.value }))}
                  />
                  <button type="button" className="btn-ghost px-2.5 py-1 text-xs text-sage-deep" onClick={() => void setVerdict(key, 'approved')}>
                    OK
                  </button>
                  <button type="button" className="btn-ghost px-2.5 py-1 text-xs text-terra-deep" onClick={() => void setVerdict(key, 'needs_fix')}>
                    Needs fix
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Final verdict */}
        <section className="card-playbill p-5">
          <h3 className="font-semibold text-ink">Final decision</h3>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-gold flex items-center gap-2"
              disabled={busy}
              onClick={() => void finalVerdict('approve')}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              Approve tutor
            </button>
            <input
              className="input-stage min-w-0 flex-1"
              placeholder="Overall reason (required to reject — shown to the applicant)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <button
              type="button"
              className="btn-ghost flex items-center gap-2 text-terra-deep"
              disabled={busy}
              onClick={() => void finalVerdict('reject')}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Reject (fixable)
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Approval sets their tutor modes from the subjects they listed and unlocks the Studio. Rejection
            keeps the application editable — they fix what you flagged and resubmit.
          </p>
        </section>
      </div>
    );
  }

  // ---------------- Queue ----------------
  return (
    <section className="card-playbill p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <ClipboardList className="h-5 w-5 text-gold-deep" aria-hidden="true" /> Tutor applications
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Screening queue. Open an application to review written answers, documents, intro video, AI
        pre-screen and the prove-your-subject test.
      </p>
      {apps.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">No applications yet.</p>
      ) : (
        <table className="mt-4 w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr className="border-b border-sand text-xs uppercase tracking-wide text-ink-soft">
              <th className="py-2 pr-4 font-medium">Applicant</th>
              <th className="py-2 pr-4 font-medium">Subjects</th>
              <th className="py-2 pr-4 font-medium">AI score</th>
              <th className="py-2 pr-4 font-medium">Paper 1</th>
              <th className="py-2 pr-4 font-medium">Paper 2</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand">
            {apps.map((a) => (
              <tr
                key={a.id}
                className={cn('cursor-pointer hover:bg-neutral-50', queue.includes(a) && 'bg-gold/5')}
                onClick={() => void openApplication(a)}
              >
                <td className="py-2.5 pr-4">
                  <p className="font-medium text-ink">{a.profiles?.full_name ?? 'Unnamed'}</p>
                  <p className="text-xs text-ink-soft">{a.profiles?.email}</p>
                </td>
                <td className="max-w-56 truncate py-2.5 pr-4 text-ink-soft">
                  {[...(a.subjects?.highschool ?? []), ...(a.subjects?.varsity ?? [])].join(', ') || '—'}
                </td>
                <td className="py-2.5 pr-4 font-mono text-ink">{a.ai_score != null ? `${a.ai_score}` : '—'}</td>
                {[1, 2].map((n) => {
                  const marked = allTests.filter(
                    (t) => t.application_id === a.id && t.attempt_no === n && t.status === 'marked' && t.total_score != null,
                  );
                  const title = marked.map((t) => `${t.subject}: ${t.total_score}/30`).join('\n');
                  const passedAll = marked.length > 0 && marked.every((t) => (t.total_score ?? 0) >= 15);
                  return (
                    <td key={n} className="py-2.5 pr-4" title={title || undefined}>
                      {marked.length === 0 ? (
                        <span className="text-ink-soft">—</span>
                      ) : (
                        <span className={cn('font-mono font-semibold', passedAll ? 'text-sage-deep' : 'text-terra-deep')}>
                          {marked.map((t) => t.total_score).join(' · ')}/30
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="py-2.5 pr-4">
                  <span className={cn('border px-2 py-0.5 text-xs font-semibold capitalize', STATUS_STYLES[a.status])}>
                    {a.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-2.5 text-ink-soft">
                  {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Prove-your-subject papers: attempts 1 & 2 with full marking detail (CEO only)
// ---------------------------------------------------------------------------

function TestScoresPanel({
  applicationId,
  setError,
  setNotice,
}: {
  applicationId: string;
  setError: (e: string | null) => void;
  setNotice: (n: string | null) => void;
}) {
  const [tests, setTests] = useState<ScreeningTestFull[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ceoDrafts, setCeoDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data } = await supabase
        .from('screening_tests')
        .select('*')
        .eq('application_id', applicationId)
        .order('subject', { ascending: true })
        .order('attempt_no', { ascending: true });
      const rows = (data as ScreeningTestFull[]) ?? [];
      setTests(rows);
      setCeoDrafts(Object.fromEntries(rows.map((t) => [t.id, t.ceo_comment ?? ''])));
    })();
  }, [applicationId]);

  const saveComment = async (t: ScreeningTestFull) => {
    if (!supabase) return;
    setSavingId(t.id);
    const comment = (ceoDrafts[t.id] ?? '').trim();
    const { error } = await supabase
      .from('screening_tests')
      .update({ ceo_comment: comment || null })
      .eq('id', t.id);
    if (error) setError(error.message);
    else {
      setTests((cur) => cur.map((x) => (x.id === t.id ? { ...x, ceo_comment: comment || null } : x)));
      setNotice('Your comment was saved.');
    }
    setSavingId(null);
  };

  return (
    <div className="card-playbill p-5">
      <h3 className="flex items-center gap-2 font-semibold text-ink">
        <ShieldCheck className="h-4 w-4 text-gold-deep" aria-hidden="true" /> Prove-your-subject papers
      </h3>
      <p className="mt-1 text-xs text-ink-soft">
        Two papers per subject, 30 marks each (10 long-form answers × 2 + overview × 10). Pass mark
        15/30. Scores are hidden from the tutor — only you see them.
      </p>
      {tests.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">No papers written yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {tests.map((t) => {
            const pass = (t.total_score ?? 0) >= 15;
            const open = expanded === t.id;
            return (
              <li key={t.id} className="border border-sand p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{t.subject}</p>
                    <p className="text-xs text-ink-soft">
                      {t.level_label} · Paper {t.attempt_no} of 2 ·{' '}
                      {t.submitted_at ? new Date(t.submitted_at).toLocaleDateString() : 'not submitted'}
                    </p>
                  </div>
                  {t.status === 'marked' && t.total_score != null ? (
                    <span
                      className={cn(
                        'border px-2 py-0.5 text-sm font-mono font-bold',
                        pass ? 'border-sage/50 bg-sage/10 text-sage-deep' : 'border-terra/40 bg-terra/5 text-terra-deep',
                      )}
                    >
                      {t.total_score}/30 {pass ? '· pass' : '· below 50%'}
                    </span>
                  ) : (
                    <span className="border border-sand px-2 py-0.5 text-xs text-ink-soft">in progress</span>
                  )}
                </div>

                {t.status === 'marked' && (
                  <>
                    {t.marker_comment && (
                      <p className="mt-2 border-l-2 border-gold/50 pl-2 text-xs text-ink-soft">
                        <span className="font-semibold text-ink">AI marker:</span> {t.marker_comment}
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn-ghost mt-2 px-2.5 py-1 text-xs"
                      onClick={() => setExpanded(open ? null : t.id)}
                    >
                      {open ? 'Hide script' : 'Read script & marks'}
                    </button>
                    {open && (
                      <div className="mt-2 space-y-3 border-t border-sand pt-3">
                        {(t.questions ?? []).map((q, i) => (
                          <div key={i}>
                            <p className="text-xs font-semibold text-ink">
                              Q{i + 1} <span className="font-mono text-gold-deep">[{t.marks?.[i] ?? 0}/2]</span>
                            </p>
                            <p className="mt-0.5 text-xs text-ink-soft">{q}</p>
                            <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink">
                              {t.answers?.[i] ?? '—'}
                            </p>
                          </div>
                        ))}
                        <div>
                          <p className="text-xs font-semibold text-ink">
                            Overview <span className="font-mono text-gold-deep">[{t.overview_mark ?? 0}/10]</span> — {t.overview_topic}
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink">{t.overview_answer ?? '—'}</p>
                        </div>
                      </div>
                    )}
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-ink" htmlFor={`ceo-${t.id}`}>
                        Your comment
                      </label>
                      <textarea
                        id={`ceo-${t.id}`}
                        className="input-stage mt-1 min-h-16 w-full text-sm"
                        value={ceoDrafts[t.id] ?? ''}
                        onChange={(e) => setCeoDrafts((cur) => ({ ...cur, [t.id]: e.target.value }))}
                        placeholder="Your private note on this paper…"
                      />
                      <button
                        type="button"
                        className="btn-ghost mt-1 px-3 py-1 text-xs"
                        disabled={savingId === t.id}
                        onClick={() => void saveComment(t)}
                      >
                        {savingId === t.id ? 'Saving…' : 'Save comment'}
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
