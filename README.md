# VukaTV

South Africa's low-data learning platform: live telegraph lessons, a study hub, varsity tutoring
with paid one-on-one sessions, and a screened tutor corps — run by an AI management team with a
human CEO.

Stack: React 18 + TypeScript + Vite + Tailwind · Supabase (Auth, Postgres + RLS, Storage, Edge
Functions, pg_cron) · GitHub → Vercel.

---

## Platform map

| Area | Route | Who |
| --- | --- | --- |
| Live telegraph lessons | /tvguide, /tv/:id | everyone |
| Study Hub (notes, flashcards, quizzes, file reader) | /study | everyone |
| Classroom, Sessions, files | /classroom, /sessions | core team |
| Varsity (paid 1-on-1 video tutoring) | /varsity | learners book, tutors offer |
| Tutor application + screening | /apply, /screening-test/:id | tutors |
| CEO Office (applications, tutors, payments) | /office | CEO |
| Management team, complaints, security | /team | CEO |
| Meeting rooms (tutors / learners) | /meetings | members |
| Waiting Room (welcome-code verification) | /waiting-room | new members |
| Library (soft security hold) | /library | held members |

Owner / CEO / admin: **youngagripreneurs.ng@gmail.com**

---

## Phase history

- **Phases 1–5** — platform core: telegraph lessons, classroom, study hub, varsity, payments,
  CEO Office, AI Studio, institutional redesign.
- **Phase 6 — Tutor screening.** 7-step application wizard with per-section verdicts, versioned
  replaceable documents (rejected files never lock you in), AI pre-screening, tutor modes
  (high-school / university) with a header switcher.
- **Phase 7 — Real account deletion.** Deactivate (reversible) vs hard delete (irreversible,
  with email receipt and audit log).
- **Phase 8 — Waiting Room.** Welcome code (4 letters + 2 digits) emailed on signup; tutors must
  verify, learners may continue after 3 failed attempts (stamped "email not verified"), optional
  WhatsApp fallback; safe room for problematic accounts.
- **Phase 9 — AI management team.** Seven managers with working hours (Mon–Sun, weekdays
  04:00–21:00, weekends 06:00–21:00 SAST), complaint workflow with HR/Quality/CEO comments and
  meeting flags, daily principal talk, Saturday manager reports, Sunday security report, platform
  kill switches (lockdown / signups / payments).
- **Phase 10 — Intelligence & proportionate response.** Doctorate titles for managers; security
  events with evidence snapshots; 4-hour library hold that looks like a normal reading room;
  doctoral field-interviewer agents (never-accuse survey cover); follow-up emails; 15-minute
  auto-release sweep; Intelligence console in Team → Security.
- **Phase 11 — Curriculum & 30-mark screening.** Full DBE subject list (Grades 8–12, GET + FET)
  with stream suggestions that never restrict choice; SA university catalogue (faculties →
  degrees → department courses by year, Wits-style naming); every tutor writes two 30-mark
  papers per subject (10 long-form × 2 marks + a 100–200 word overview × 10), AI-marked
  server-side, scores hidden from tutors, both attempts + AI marker comment + CEO comment on
  the CEO dashboard; learners state their needs when booking a session.
- **Phase 12 — Reach & trust.** Public SEO layer (meta, JSON-LD, robots.txt, sitemap, static
  crawlable HTML), public /about landing page, public /tutors directory with per-session 1–5
  star reviews, 90-minute time-boxed screening papers with per-applicant shuffling and tutor
  feedback bands (scores stay CEO-only).

---

## Deploy checklist (Supabase)

### SQL (SQL Editor, in order)
1. `supabase/schema.sql` … base tables + RLS
2. `supabase/quiz_vp.sql`, `supabase/varsity.sql`, `supabase/office.sql`, `supabase/telegraph.sql`,
   `supabase/public_roles.sql`
3. `supabase/screening.sql` — applications, documents, tutor modes
4. `supabase/deletion.sql` — deactivation + deletion audit
5. `supabase/waiting_room.sql` — welcome codes, safe room
6. `supabase/management.sql` — managers, complaints, staff posts, reports, settings flags
7. `supabase/intelligence.sql` — security events, library holds, library chats
8. `supabase/curriculum_screening.sql` — 30-mark screening tests, learner needs on bookings
9. `supabase/public_directory.sql` — public tutor directory + reviews
10. `supabase/cron.sql` — pg_cron jobs (daily principal talk, Saturday manager reports, Sunday
   security report, 15-minute library sweep)

### Edge functions (paste from `supabase/dashboard-deploy/`)
Verify JWT **ON**: ask-ai, study-tools, tutor-assist, extract-file-text, screening-test,
prescreen-application, review-application, review-payment, submit-payment, delete-account,
welcome-code, manager-chat, library-survey, session-summary, notify-presence.
Verify JWT **OFF** (cron-called, bearer `CRON_SECRET`): daily-digest, daily-talk, staff-report,
library-sweep.

### Secrets
`DEEPSEEK_API_KEY`, `BREVO_API_KEY`, `CRON_SECRET` — Supabase secrets only, never in the frontend.

---

## Security notes
- DeepSeek/Brevo keys live only in Supabase secrets — never in the frontend or git.
- Every table has Row Level Security; scoring, deletion, review and code verification run
  service-side only.
- Screening test scores never leave the server — tutors see only "received"; the CEO sees marks.
- All user/AI HTML is sanitized (DOMPurify) before rendering; external links are https-only.
- Payment proofs and tutor documents live in private buckets with short-lived signed URLs.

## Local development
```bash
cp .env.example .env.local   # fill in your Supabase values
npm install
npm run dev
```
