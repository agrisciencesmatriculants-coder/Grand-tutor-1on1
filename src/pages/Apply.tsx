import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { SCHOOL_GRADES, STREAM_SUGGESTIONS, subjectsForGrade } from '../lib/curriculum';
import { FACULTIES, courseLabel, type Course } from '../lib/universities';
import type { ScreeningTestSafe, TutorApplication, TutorDocument } from '../lib/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
];

const SA_LANGUAGES = [
  'English', 'Afrikaans', 'isiZulu', 'isiXhosa', 'Sepedi', 'Setswana',
  'Sesotho', 'Xitsonga', 'siSwati', 'Tshivenda', 'isiNdebele',
];

/** Stored subject strings: "Physical Sciences · Grade 12" or "Financial Accounting II (ACCN2000) · Year 2". */
function trackOf(stored: string): 'school' | 'varsity' {
  return /\(.*\)\s*·\s*Year\s*\d/.test(stored) ? 'varsity' : 'school';
}
function levelLabelOf(stored: string): string {
  const track = trackOf(stored);
  if (track === 'varsity') return stored;
  const m = stored.match(/·\s*(Grade\s*\d+)\s*$/);
  return m ? m[1] : 'Grade 12';
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};
const SLOTS = ['morning', 'afternoon', 'evening'] as const;

const STEPS = ['About you', 'Motivation', 'Subjects & levels', 'Availability', 'Intro video', 'Documents', 'Review & submit'] as const;

const VIDEO_CHECKLIST = [
  '45 seconds to 1 minute 30 seconds long',
  'Look directly at the camera and smile',
  'Good lighting on your face, quiet background',
  'Say your full name, the subjects you want to teach, and why you want to tutor',
  'Upload to YouTube as UNLISTED (not private, not public) and paste the link below',
];

const YOUTUBE_RE = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?[^\s]*v=|shorts\/)|youtu\.be\/)[\w-]{6,}/i;

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function SectionNote({ app, section }: { app: TutorApplication; section: string }) {
  const verdict = app.section_status?.[section];
  const note = app.section_notes?.[section];
  if (verdict !== 'needs_fix') return null;
  return (
    <div className="mt-3 flex items-start gap-2 border border-terra/40 bg-terra/5 px-3 py-2 text-sm text-terra">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">This section needs changes{note ? ':' : '.'}</p>
        {note && <p className="mt-0.5">{note}</p>}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border px-3 py-1.5 text-sm transition',
        active
          ? 'border-gold bg-gold text-white'
          : 'border-sand bg-white text-ink-soft hover:border-gold/60',
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Apply() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [app, setApp] = useState<TutorApplication | null>(null);
  const [docs, setDocs] = useState<TutorDocument[]>([]);
  const [tests, setTests] = useState<ScreeningTestSafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !profile) return;
    const { data } = await supabase
      .from('tutor_applications')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();
    const application = (data as TutorApplication | null) ?? null;
    setApp(application);
    if (application) {
      const { data: d } = await supabase
        .from('tutor_documents')
        .select('*')
        .eq('application_id', application.id)
        .order('created_at', { ascending: false });
      setDocs((d as TutorDocument[]) ?? []);
      const { data: t } = await supabase
        .from('my_screening_tests')
        .select('*')
        .eq('application_id', application.id)
        .order('created_at', { ascending: true });
      setTests((t as ScreeningTestSafe[]) ?? []);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const editable = !app || app.status === 'draft' || app.status === 'rejected';

  /** Create the draft row on first save, or patch the existing one. */
  const save = useCallback(
    async (patch: Partial<TutorApplication>, advance = false) => {
      if (!supabase || !profile) return false;
      setSaving(true);
      setError(null);
      try {
        if (!app) {
          const { data, error: e } = await supabase
            .from('tutor_applications')
            .insert({ user_id: profile.id, ...patch })
            .select('*')
            .single();
          if (e) throw e;
          setApp(data as TutorApplication);
        } else {
          const { data, error: e } = await supabase
            .from('tutor_applications')
            .update(patch)
            .eq('id', app.id)
            .select('*')
            .single();
          if (e) throw e;
          setApp(data as TutorApplication);
        }
        if (advance) setStep((s) => Math.min(s + 1, STEPS.length - 1));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [app, profile],
  );

  const latestDoc = useCallback(
    (kind: TutorDocument['kind']) => docs.find((d) => d.kind === kind && d.status !== 'superseded') ?? null,
    [docs],
  );

  const validationErrors = useMemo(() => {
    if (!app) return ['Complete every section before submitting.'];
    const errs: string[] = [];
    if (!app.about?.province) errs.push('Choose your province.');
    if ((app.about?.languages ?? []).length === 0) errs.push('Choose at least one teaching language.');
    if ((app.motivation?.why_tutor ?? '').trim().length < 150)
      errs.push('Tell us why you want to tutor (at least 150 characters).');
    if ((app.motivation?.experience ?? '').trim().length < 20)
      errs.push('Describe your teaching or tutoring experience.');
    if ((app.subjects?.highschool ?? []).length + (app.subjects?.varsity ?? []).length === 0)
      errs.push('Add at least one subject or university course.');
    if (DAYS.every((d) => (app.availability?.[d] ?? []).length === 0))
      errs.push('Mark at least one availability slot.');
    if (!app.video_url || !YOUTUBE_RE.test(app.video_url))
      errs.push('Add a valid unlisted YouTube intro video link.');
    if (!latestDoc('id_document')) errs.push('Upload your ID document.');
    if (!latestDoc('transcript')) errs.push('Upload your academic transcript.');
    return errs;
  }, [app, latestDoc]);

  const submit = async () => {
    if (validationErrors.length > 0 || !app) return;
    const ok = await save({ status: 'submitted', submitted_at: new Date().toISOString() });
    if (ok) {
      setNotice('Application submitted. Your subject papers are ready below — our team will review everything together.');
      await load();
    }
  };

  const startTest = async (stored: string) => {
    if (!supabase) return;
    setTesting(stored);
    setError(null);
    try {
      const track = trackOf(stored);
      const { data, error: e } = await supabase.functions.invoke('screening-test', {
        body: { action: 'start', track, subject: stored, levelLabel: levelLabelOf(stored) },
      });
      if (e) throw new Error(e.message);
      if (data?.error) throw new Error(data.error);
      navigate(`/screening-test/${data.test_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the test.');
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-ink-soft">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const status = app?.status ?? 'draft';

  // -------------------------------------------------------------------------
  // Status view: submitted / in_review / approved
  // -------------------------------------------------------------------------
  if (app && !editable) {
    const allSubjects: string[] = [
      ...(app.subjects?.highschool ?? []),
      ...(app.subjects?.varsity ?? []),
    ];
    const testsFor = (subject: string) =>
      tests.filter((t) => t.subject.toLowerCase() === subject.toLowerCase());
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="card-playbill p-6">
          <div className="flex items-start gap-3">
            {status === 'approved' ? (
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-gold" aria-hidden="true" />
            ) : (
              <Clock className="mt-0.5 h-6 w-6 shrink-0 text-gold" aria-hidden="true" />
            )}
            <div>
              <h1 className="text-xl font-bold text-ink">
                {status === 'approved' ? 'You are an approved VukaTV tutor' : 'Application under review'}
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                {status === 'approved'
                  ? 'Your Studio is unlocked. Record telegraph lessons, schedule broadcasts and build quizzes.'
                  : 'Our team is reviewing your application. You will receive an email with the outcome. If anything needs changes, you will be able to edit just that section and resubmit.'}
              </p>
            </div>
          </div>
          {status === 'approved' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/studio" className="btn-gold">Open Studio</Link>
              {(profile?.tutor_modes ?? []).includes('varsity') && (
                <Link to="/varsity" className="btn-ghost">Create a Varsity offering</Link>
              )}
            </div>
          )}
        </div>

        {notice && (
          <div className="border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink">{notice}</div>
        )}
        {error && (
          <div className="border border-terra/40 bg-terra/5 px-4 py-3 text-sm text-terra">{error}</div>
        )}

        {/* Prove-your-subject papers (scores are never shown to tutors) */}
        {status !== 'approved' && (
          <div className="card-playbill p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
              <div>
                <h2 className="font-bold text-ink">Prove-your-subject papers</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  For each subject you listed, you write two short papers in the style of official
                  past papers: ten written questions plus a brief subject overview. Our examiners
                  mark them together with your application — you will simply see that your paper
                  was received.
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {allSubjects.map((subject) => {
                const done = testsFor(subject);
                const markedCount = done.filter((t) => t.status === 'marked').length;
                const nextAttempt = done.find((t) => t.status === 'in_progress')
                  ? done.find((t) => t.status === 'in_progress')!.attempt_no
                  : markedCount + 1;
                const complete = markedCount >= 2;
                return (
                  <li
                    key={subject}
                    className="flex flex-wrap items-center justify-between gap-2 border border-sand px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{subject}</p>
                      <p className="text-xs text-ink-soft">
                        {complete
                          ? 'Both papers received — with the review team.'
                          : markedCount === 1
                            ? 'Paper 1 received. Paper 2 is ready when you are.'
                            : 'No paper written yet.'}
                        {done.some((t) => t.band) && (
                          <span className="block">
                            Feedback so far:{' '}
                            {done.filter((t) => t.band).map((t) => `Paper ${t.attempt_no}: ${t.band}`).join(' · ')}
                          </span>
                        )}
                      </p>
                    </div>
                    {!complete && (
                      <button
                        type="button"
                        disabled={testing !== null}
                        onClick={() => void startTest(subject)}
                        className="btn-ghost flex items-center gap-2 text-sm"
                      >
                        {testing === subject ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <ClipboardList className="h-4 w-4" aria-hidden="true" />
                        )}
                        {done.some((t) => t.status === 'in_progress')
                          ? `Resume paper ${nextAttempt}`
                          : `Write paper ${nextAttempt} of 2`}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="card-playbill p-6">
          <h2 className="font-bold text-ink">What happens next</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
            <li>AI pre-screening summarises your written answers for the review team.</li>
            <li>A human reviewer checks your documents, watches your intro video and looks at your test score.</li>
            <li>You receive an email: approved, or rejected with the exact sections to fix — your application stays saved and editable.</li>
          </ol>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Wizard (draft or rejected -> editable)
  // -------------------------------------------------------------------------
  const next = () => void save({}, true);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-ink">Tutor application</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Every VukaTV tutor passes this screening. Your progress saves at each step — you can leave and
        come back at any time.
      </p>

      {status === 'rejected' && (
        <div className="mt-4 border border-terra/40 bg-terra/5 px-4 py-3">
          <div className="flex items-start gap-2 text-sm text-terra">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Your application needs changes before it can be approved.</p>
              {app?.rejection_reason && <p className="mt-1">{app.rejection_reason}</p>}
              <p className="mt-1">Fix the flagged sections below and submit again — nothing else was lost.</p>
            </div>
          </div>
        </div>
      )}

      {/* Stepper */}
      <ol className="mt-6 flex flex-wrap gap-1">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                'border px-2.5 py-1 text-xs font-medium transition',
                i === step
                  ? 'border-gold bg-gold text-white'
                  : i < step
                    ? 'border-gold/40 bg-gold/10 text-ink'
                    : 'border-sand bg-white text-ink-soft',
              )}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {error && (
        <div className="mt-4 border border-terra/40 bg-terra/5 px-4 py-3 text-sm text-terra">{error}</div>
      )}

      <div className="card-playbill mt-4 p-6">
        {step === 0 && <StepAbout app={app} save={save} saving={saving} />}
        {step === 1 && <StepMotivation app={app} save={save} saving={saving} />}
        {step === 2 && <StepSubjects app={app} save={save} saving={saving} />}
        {step === 3 && <StepAvailability app={app} save={save} saving={saving} />}
        {step === 4 && <StepVideo app={app} save={save} saving={saving} />}
        {step === 5 && (
          <StepDocuments
            app={app}
            docs={docs}
            latestDoc={latestDoc}
            reload={load}
            setError={setError}
          />
        )}
        {step === 6 && (
          <div>
            <h2 className="font-bold text-ink">Review &amp; submit</h2>
            {app && (
              <div className="mt-4 space-y-3 text-sm">
                <ReviewRow label="Province" value={app.about?.province ?? '—'} />
                <ReviewRow label="Languages" value={(app.about?.languages ?? []).join(', ') || '—'} />
                <ReviewRow
                  label="Subjects"
                  value={
                    [
                      ...(app.subjects?.highschool ?? []),
                      ...(app.subjects?.varsity ?? []),
                    ].join(', ') || '—'
                  }
                />
                <ReviewRow
                  label="Availability"
                  value={
                    DAYS.filter((d) => (app.availability?.[d] ?? []).length > 0)
                      .map((d) => `${DAY_LABELS[d]}: ${(app.availability?.[d] ?? []).join(', ')}`)
                      .join(' · ') || '—'
                  }
                />
                <ReviewRow label="Intro video" value={app.video_url ?? '—'} />
                <ReviewRow
                  label="Documents"
                  value={`ID: ${latestDoc('id_document') ? 'uploaded' : 'missing'} · Transcript: ${latestDoc('transcript') ? 'uploaded' : 'missing'}`}
                />
              </div>
            )}
            {validationErrors.length > 0 ? (
              <div className="mt-4 border border-terra/40 bg-terra/5 px-4 py-3">
                <p className="text-sm font-semibold text-terra">Before you can submit:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-terra">
                  {validationErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-4 border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink">
                Everything is complete. After submitting, take your prove-your-subject test — our review
                team then checks your documents, video and answers.
              </div>
            )}
            <div className="mt-6 flex justify-between">
              <button type="button" className="btn-ghost flex items-center gap-1" onClick={() => setStep(5)}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
              </button>
              <button
                type="button"
                className="btn-gold flex items-center gap-2"
                disabled={saving || validationErrors.length > 0}
                onClick={() => void submit()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                Submit application
              </button>
            </div>
          </div>
        )}

        {step < 6 && (
          <div className="mt-6 flex justify-between border-t border-sand pt-4">
            <button
              type="button"
              className="btn-ghost flex items-center gap-1"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
            </button>
            <button type="button" className="btn-gold flex items-center gap-1" disabled={saving} onClick={next}>
              Save &amp; continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-sand pb-2">
      <span className="w-32 shrink-0 font-semibold text-ink">{label}</span>
      <span className="text-ink-soft">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: About
// ---------------------------------------------------------------------------

function StepAbout({ app, save, saving }: StepProps) {
  const [province, setProvince] = useState(app?.about?.province ?? '');
  const [languages, setLanguages] = useState<string[]>(app?.about?.languages ?? []);
  const [phone, setPhone] = useState(app?.about?.phone ?? '');
  return (
    <div>
      <h2 className="font-bold text-ink">About you</h2>
      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="province">Province</label>
          <select id="province" className="input-stage" value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="">Choose your province…</option>
            {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-sm font-semibold text-ink">Languages you can teach in</span>
          <div className="flex flex-wrap gap-2">
            {SA_LANGUAGES.map((l) => (
              <Chip
                key={l}
                active={languages.includes(l)}
                onClick={() =>
                  setLanguages((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]))
                }
              >
                {l}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="phone">Contact number (optional)</label>
          <input id="phone" className="input-stage" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 082 123 4567" />
        </div>
      </div>
      <StepSave saving={saving} onSave={() => save({ about: { province, languages, phone } })} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Motivation
// ---------------------------------------------------------------------------

function StepMotivation({ app, save, saving }: StepProps) {
  const [why, setWhy] = useState(app?.motivation?.why_tutor ?? '');
  const [experience, setExperience] = useState(app?.motivation?.experience ?? '');
  return (
    <div>
      <h2 className="font-bold text-ink">Motivation</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Answer in your own words. Generic or copy-pasted answers are flagged by our pre-screening.
      </p>
      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="why">
            Why do you want to tutor on VukaTV? <span className="font-normal text-ink-soft">(min. 150 characters)</span>
          </label>
          <textarea
            id="why"
            className="input-stage min-h-32"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="Tell us what teaching means to you, who you want to help, and what you will bring to learners…"
          />
          <p className={cn('mt-1 text-xs', why.trim().length >= 150 ? 'text-sage' : 'text-ink-soft/70')}>
            {why.trim().length}/150 characters
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="exp">
            Teaching or tutoring experience
          </label>
          <textarea
            id="exp"
            className="input-stage min-h-24"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder="School, university, informal tutoring, helping classmates — it all counts. No experience yet? Tell us how you would approach your first lesson."
          />
        </div>
      </div>
      {app && <SectionNote app={app} section="motivation" />}
      <StepSave saving={saving} onSave={() => save({ motivation: { why_tutor: why, experience } })} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Subjects & levels (tutor modes)
// ---------------------------------------------------------------------------

function StepSubjects({ app, save, saving }: StepProps) {
  const [hs, setHs] = useState<string[]>(app?.subjects?.highschool ?? []);
  const [varsity, setVarsity] = useState<string[]>(app?.subjects?.varsity ?? []);
  const [grade, setGrade] = useState<number>(12);
  const [faculty, setFaculty] = useState(FACULTIES[0].name);
  const [degreeName, setDegreeName] = useState(FACULTIES[0].degrees[0].name);
  const [year, setYear] = useState(1);
  const [courseInput, setCourseInput] = useState('');

  const degree = FACULTIES.find((f) => f.name === faculty)?.degrees.find((d) => d.name === degreeName);
  const yearCourses: Course[] = (degree?.courses ?? []).filter((c) => c.year === year);

  const toggleHs = (stored: string) =>
    setHs((cur) => (cur.includes(stored) ? cur.filter((x) => x !== stored) : [...cur, stored]));
  const toggleCourse = (label: string) =>
    setVarsity((cur) => (cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]));

  const addCourse = () => {
    const v = courseInput.trim();
    if (v && !varsity.includes(v)) setVarsity([...varsity, v]);
    setCourseInput('');
  };

  const categories = subjectsForGrade(grade);

  return (
    <div>
      <h2 className="font-bold text-ink">Subjects &amp; levels</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Choose what you want to teach. You can teach at both levels — for example Grade 12 Maths and
        your university course. Each level becomes a mode you can switch between after approval.
      </p>
      <div className="mt-4 space-y-6">
        {/* High school */}
        <div>
          <span className="mb-2 block text-sm font-semibold text-ink">High School — DBE / CAPS (Grades 8–12)</span>

          {/* Grade picker */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Grade">
            {SCHOOL_GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrade(g)}
                className={cn(
                  'border px-3 py-1 text-sm font-medium transition',
                  grade === g ? 'border-gold bg-gold text-white' : 'border-sand bg-white text-ink-soft hover:border-gold/60',
                )}
              >
                Grade {g}
              </button>
            ))}
          </div>

          {/* Stream suggestions (guidance only, never a restriction) */}
          {grade >= 10 && (
            <div className="mt-3 border border-sand bg-ivory-deep/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Common combinations — tap to add, then adjust freely
              </p>
              <p className="mt-0.5 text-xs text-ink-soft/80">
                Learners mix across combinations all the time (Agricultural Sciences with Physical
                Sciences, Geography with Business Studies). These are starting points, not fixed streams.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {STREAM_SUGGESTIONS.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    title={`${s.blurb} Adds: ${s.subjects.join(', ')}`}
                    onClick={() =>
                      setHs((cur) => {
                        const next = new Set(cur);
                        s.subjects.forEach((sub) => next.add(`${sub} · Grade ${grade}`));
                        return [...next];
                      })
                    }
                    className="border border-gold/40 bg-white px-2.5 py-1 text-xs text-ink transition hover:bg-gold/10"
                  >
                    + {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subjects grouped by DBE category */}
          <div className="mt-3 space-y-3">
            {categories.map((cat) => (
              <div key={cat.name}>
                <p className="mb-1 text-xs font-semibold text-ink-soft">{cat.name}</p>
                <div className="flex flex-wrap gap-2">
                  {cat.subjects.map((s) => {
                    const stored = `${s} · Grade ${grade}`;
                    return (
                      <Chip key={stored} active={hs.includes(stored)} onClick={() => toggleHs(stored)}>
                        {s}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {hs.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-ink-soft">Selected school subjects</p>
              <div className="flex flex-wrap gap-2">
                {hs.map((s) => (
                  <span key={s} className="flex items-center gap-1 border border-gold/40 bg-gold/10 px-2.5 py-1 text-sm text-ink">
                    {s}
                    <button type="button" onClick={() => setHs(hs.filter((x) => x !== s))} aria-label={`Remove ${s}`}>
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Varsity */}
        <div>
          <span className="mb-2 block text-sm font-semibold text-ink">University courses (Varsity)</span>
          <p className="mb-2 text-xs text-ink-soft/80">
            Faculties, degrees and courses follow the South African university faculty booklets
            (Wits naming). Course names differ between universities, so courses are grouped by
            department and year — pick the department course, whatever your university calls it.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-medium text-ink-soft">
              Faculty
              <select
                className="input-stage mt-1 w-full"
                value={faculty}
                onChange={(e) => {
                  const f = FACULTIES.find((x) => x.name === e.target.value)!;
                  setFaculty(f.name);
                  setDegreeName(f.degrees[0].name);
                  setYear(1);
                }}
              >
                {FACULTIES.map((f) => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-ink-soft">
              Degree
              <select
                className="input-stage mt-1 w-full"
                value={degreeName}
                onChange={(e) => { setDegreeName(e.target.value); setYear(1); }}
              >
                {(FACULTIES.find((f) => f.name === faculty)?.degrees ?? []).map((d) => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-ink-soft">
              Year of study
              <select
                className="input-stage mt-1 w-full"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {Array.from({ length: degree?.years ?? 3 }, (_, i) => i + 1).map((y) => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </label>
          </div>
          {yearCourses.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {yearCourses.map((c) => (
                <Chip key={c.code} active={varsity.includes(courseLabel(c))} onClick={() => toggleCourse(courseLabel(c))}>
                  {c.name} <span className="text-xs opacity-70">({c.code})</span>
                </Chip>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <input
              className="input-stage"
              value={courseInput}
              onChange={(e) => setCourseInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCourse(); } }}
              placeholder="Course not listed? Add it exactly as your university calls it…"
              aria-label="Add a university course"
            />
            <button type="button" className="btn-ghost shrink-0" onClick={addCourse}>Add</button>
          </div>
          {varsity.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {varsity.map((c) => (
                <span key={c} className="flex items-center gap-1 border border-gold/40 bg-gold/10 px-2.5 py-1 text-sm text-ink">
                  {c}
                  <button type="button" onClick={() => setVarsity(varsity.filter((x) => x !== c))} aria-label={`Remove ${c}`}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {app && <SectionNote app={app} section="subjects" />}
      <StepSave saving={saving} onSave={() => save({ subjects: { highschool: hs, varsity } })} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Availability
// ---------------------------------------------------------------------------

function StepAvailability({ app, save, saving }: StepProps) {
  const [grid, setGrid] = useState<Record<string, string[]>>(app?.availability ?? {});
  const toggle = (day: string, slot: string) =>
    setGrid((cur) => {
      const slots = cur[day] ?? [];
      return { ...cur, [day]: slots.includes(slot) ? slots.filter((s) => s !== slot) : [...slots, slot] };
    });
  return (
    <div>
      <h2 className="font-bold text-ink">Availability</h2>
      <p className="mt-1 text-sm text-ink-soft">When can learners usually reach you? This guides broadcast scheduling and Varsity bookings.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-sand bg-neutral-50 px-3 py-2 text-left font-semibold text-ink">Day</th>
              {SLOTS.map((s) => (
                <th key={s} className="border border-sand bg-neutral-50 px-3 py-2 text-center font-semibold capitalize text-ink">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d}>
                <td className="border border-sand px-3 py-2 font-medium text-ink">{DAY_LABELS[d]}</td>
                {SLOTS.map((s) => {
                  const active = (grid[d] ?? []).includes(s);
                  return (
                    <td key={s} className="border border-sand px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggle(d, s)}
                        aria-pressed={active}
                        aria-label={`${DAY_LABELS[d]} ${s}`}
                        className={cn(
                          'inline-flex h-7 w-7 items-center justify-center border transition',
                          active ? 'border-gold bg-gold text-white' : 'border-sand bg-white text-transparent hover:border-gold/60',
                        )}
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {app && <SectionNote app={app} section="availability" />}
      <StepSave saving={saving} onSave={() => save({ availability: grid })} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Video
// ---------------------------------------------------------------------------

function StepVideo({ app, save, saving }: StepProps) {
  const [url, setUrl] = useState(app?.video_url ?? '');
  const valid = YOUTUBE_RE.test(url);
  return (
    <div>
      <h2 className="font-bold text-ink">Intro video</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Record a short video introducing yourself, upload it to YouTube as <strong>unlisted</strong>, and
        paste the link. Our reviewers watch every video — this is also what learners will see on your
        tutor profile, so make it count.
      </p>
      <ul className="mt-4 space-y-2">
        {VIDEO_CHECKLIST.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink-soft">
            <Video className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="video">YouTube link (unlisted)</label>
        <input
          id="video"
          className="input-stage"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtu.be/…"
        />
        {url && !valid && (
          <p className="mt-1 text-xs text-terra">This does not look like a YouTube link.</p>
        )}
      </div>
      {app && <SectionNote app={app} section="video" />}
      <StepSave saving={saving} onSave={() => save({ video_url: url.trim() })} disabled={!valid} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6: Documents — versioned, replacable, never silently locked
// ---------------------------------------------------------------------------

function DocUploader({
  app,
  kind,
  label,
  hint,
  doc,
  reload,
  setError,
}: {
  app: TutorApplication | null;
  kind: TutorDocument['kind'];
  label: string;
  hint: string;
  doc: TutorDocument | null;
  reload: () => Promise<void>;
  setError: (e: string | null) => void;
}) {
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!supabase || !profile || !app) return;
    setUploading(true);
    setError(null);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, '-').slice(-60);
      const path = `${profile.id}/${kind}-${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('tutor-docs').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
      });
      if (upErr) throw upErr;
      // Mark any previous version as superseded (the anti-Superprof rule:
      // a wrong upload never locks you out — you simply replace it).
      if (doc) {
        await supabase.from('tutor_documents').update({ status: 'superseded' }).eq('id', doc.id);
      }
      const { error: insErr } = await supabase.from('tutor_documents').insert({
        application_id: app.id,
        user_id: profile.id,
        kind,
        file_path: path,
        version: (doc?.version ?? 0) + 1,
      });
      if (insErr) throw insErr;
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border border-sand p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{label}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>
        </div>
        {doc && (
          <span
            className={cn(
              'shrink-0 border px-2 py-0.5 text-xs font-medium',
              doc.status === 'approved' && 'border-gold/40 bg-gold/10 text-ink',
              doc.status === 'pending' && 'border-sand bg-neutral-50 text-ink-soft',
              doc.status === 'rejected' && 'border-terra/40 bg-terra/5 text-terra',
            )}
          >
            {doc.status === 'pending' ? 'Awaiting review' : doc.status}
          </span>
        )}
      </div>
      {doc?.status === 'rejected' && doc.reject_reason && (
        <p className="mt-2 border-l-2 border-terra pl-2 text-xs text-terra">
          Rejected: {doc.reject_reason} — upload the correct file below.
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <label
          className={cn(
            'btn-ghost flex cursor-pointer items-center gap-2',
            (uploading || !app) && 'pointer-events-none opacity-50',
          )}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {doc ? 'Replace file' : 'Upload file'}
          <input
            type="file"
            className="hidden"
            accept="image/*,application/pdf"
            disabled={uploading || !app}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = '';
            }}
          />
        </label>
        {doc && (
          <span className="flex items-center gap-1 text-xs text-ink-soft">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" /> v{doc.version} uploaded
          </span>
        )}
      </div>
    </div>
  );
}

function StepDocuments({
  app,
  docs,
  latestDoc,
  reload,
  setError,
}: {
  app: TutorApplication | null;
  docs: TutorDocument[];
  latestDoc: (k: TutorDocument['kind']) => TutorDocument | null;
  reload: () => Promise<void>;
  setError: (e: string | null) => void;
}) {
  void docs;
  return (
    <div>
      <h2 className="font-bold text-ink">Documents</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Upload clear scans or photos (PDF or image). If you upload the wrong file, simply replace it —
        you are never locked in, and if a reviewer rejects a document you can upload a new version.
      </p>
      {!app && (
        <p className="mt-3 border border-sand bg-neutral-50 px-3 py-2 text-sm text-ink-soft">
          Save an earlier step first so your application exists before uploading documents.
        </p>
      )}
      <div className="mt-4 space-y-4">
        <DocUploader app={app} kind="id_document" label="ID document" hint="South African ID, passport or smart ID card." doc={latestDoc('id_document')} reload={reload} setError={setError} />
        <DocUploader app={app} kind="transcript" label="Academic transcript" hint="Latest school results, matric certificate or university transcript." doc={latestDoc('transcript')} reload={reload} setError={setError} />
      </div>
      {app && <SectionNote app={app} section="id_document" />}
      {app && <SectionNote app={app} section="transcript" />}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface StepProps {
  app: TutorApplication | null;
  save: (patch: Partial<TutorApplication>, advance?: boolean) => Promise<boolean>;
  saving: boolean;
}

function StepSave({ saving, onSave, disabled }: { saving: boolean; onSave: () => Promise<boolean>; disabled?: boolean }) {
  return (
    <div className="mt-5">
      <button type="button" className="btn-ghost flex items-center gap-2" disabled={saving || disabled} onClick={() => void onSave()}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
        Save this section
      </button>
    </div>
  );
}
