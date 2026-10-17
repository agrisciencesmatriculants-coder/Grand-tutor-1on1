import { Link } from 'react-router-dom';
import {
  BookOpen,
  GraduationCap,
  Radio,
  ShieldCheck,
  Trophy,
  Users,
  Video,
  Zap,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Radio,
    title: 'Live telegraph lessons',
    body: 'Teachers broadcast slides and voice — not heavy video — so a full lesson costs a fraction of the data. Learners watch the TV guide, join live, and catch recordings afterwards.',
  },
  {
    icon: BookOpen,
    title: 'AI study hub',
    body: 'Upload your notes or past papers and get summaries, flashcards, page-by-page walkthroughs and practice quizzes — in your language, at your pace.',
  },
  {
    icon: Trophy,
    title: 'Cheat-proof quizzes & Vuka Points',
    body: 'Quizzes are scored on our servers — answers never reach the browser. Learners earn Vuka Points for real work, not for gaming the system.',
  },
  {
    icon: Video,
    title: 'Varsity tutoring',
    body: 'University students book paid one-on-one video sessions with screened tutors, matched by faculty, degree, department and year of study.',
  },
  {
    icon: ShieldCheck,
    title: 'Real screening',
    body: 'Every tutor writes two 30-mark papers per subject in the style of official past papers, uploads an ID and transcript, and records an intro video. A human reviews everything before anyone teaches.',
  },
  {
    icon: Users,
    title: 'A management team that never sleeps',
    body: 'Doctoral-level AI managers handle HR, quality, learner success, finance and security — with a human CEO making the final calls.',
  },
];

const STREAMS = [
  'Science', 'Commerce', 'Humanities', 'Technical / Engineering',
  'Agriculture', 'Hospitality & Tourism', 'IT & Computing', 'Arts & Design',
];

/** Public landing page — no account needed. Written for people and crawlers alike. */
export default function About() {
  return (
    <div className="min-h-screen bg-ivory font-sans text-ink">
      <header className="border-b border-sand bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <p className="text-lg font-bold">
            <span className="text-gold-deep">Vuka</span>TV
          </p>
          <Link to="/login" className="btn-gold px-4 py-2 text-sm">Sign in / Join</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-12 px-4 py-10">
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-sage-deep">
            South African low-data learning platform
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">
            Learn more. Use less data. <span className="text-gold-deep">Vuka.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-ink-soft">
            VukaTV is built for South African realities: data is expensive, classrooms are crowded,
            and good help is hard to find. We stream lessons as light telegraphs, turn notes into
            study packs with AI, and connect learners with tutors who have genuinely proved they
            know their subjects — from Grade 8 to final-year university.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login" className="btn-gold px-5 py-2.5">Create a free account</Link>
            <Link to="/tutors" className="btn-ghost px-5 py-2.5">Browse screened tutors</Link>
            <a href="#screening" className="btn-ghost px-5 py-2.5">How we screen tutors</a>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold">What you get</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <article key={f.title} className="card-playbill p-5">
                <f.icon className="h-5 w-5 text-gold-deep" aria-hidden="true" />
                <h3 className="mt-2 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold">Every subject, every level</h2>
          <p className="mt-2 text-sm text-ink-soft">
            All official DBE subjects for Grades 8–12 — every official language, Mathematics,
            Physical Sciences, Accounting, Geography, IT and more — with common combinations to
            start from and complete freedom to mix:
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {STREAMS.map((s) => (
              <li key={s} className="border border-sand bg-white px-3 py-1 text-sm">{s}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-soft">
            At university level, courses follow South African faculty booklets — Commerce,
            Engineering, Health Sciences (including the full six-year MBChB), Science, Humanities
            and Education — organised by department and year, so a course means the same thing
            whether you study at Wits, UCT, Rhodes or Stellenbosch.
          </p>
        </section>

        <section id="screening">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <GraduationCap className="h-5 w-5 text-gold-deep" aria-hidden="true" />
            How we screen tutors
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
            <li>Seven-step application: motivation, subjects, availability, and an intro video.</li>
            <li>Verified documents: ID and academic transcript, replaceable until approved — a wrong upload never locks you out.</li>
            <li>Two 30-mark subject papers in past-paper style: ten written answers plus a subject overview, marked by external AI examiners.</li>
            <li>A human CEO reviews the papers, comments, documents and video before approval.</li>
          </ol>
        </section>

        <section>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Zap className="h-5 w-5 text-gold-deep" aria-hidden="true" />
            Safe by design
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Welcome-code verification keeps accounts real. A proportionate security system watches
            for genuine threats and responds gently first — we protect learners without punishing
            the innocent. Your data stays yours: accounts can be deactivated or fully deleted at
            any time, and we actually delete.
          </p>
        </section>

        <section className="card-playbill p-6 text-center">
          <h2 className="text-lg font-bold">Ready to vuka?</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Learners join free. Tutors apply, prove their subjects, and start earning.
          </p>
          <Link to="/login" className="btn-gold mt-4 inline-block px-6 py-2.5">Join VukaTV</Link>
        </section>
      </main>

      <footer className="border-t border-sand py-6 text-center text-xs text-ink-soft">
        VukaTV — South African low-data learning platform · youngagripreneurs.ng@gmail.com
      </footer>
    </div>
  );
}
