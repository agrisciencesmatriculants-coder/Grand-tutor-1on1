# 🎭 Young Agripreneurs 1 Tutor

A private, three-voice digital classroom for **George** (teacher), **Kelebogile** (learner — NSC candidate, future actress), and **Agron** (AI tutor, powered by DeepSeek). Built with React + Vite, Supabase, Vercel and GitHub.

> *A stage for Kelebogile's dreams — where marks improve, confidence grows, and every lesson is opening night.*

---

## What's inside

| Feature | Details |
|---|---|
| **Private gate** | Only the two invited accounts can ever sign in (enforced in DB trigger + RLS + app). |
| **WhatsApp-style chat** | Realtime messages, voice notes, file attachments, single / double / gold-double read ticks, typing indicator. |
| **Agron in the chat** | Type `@ai` anywhere — Agron reads your conversation *and the text of uploaded files* to help George explain and Kelebogile understand. |
| **Shared File Vault** | Both upload learning material (PDF, DOCX, slides, images, audio ≤ 25 MB), preview in-app, download, and every file's text is extracted so Agron can teach from it. |
| **Live Stage** | George pushes slides/images/PDFs to a shared realtime screen (or pastes with Ctrl+V) and broadcasts near-live voice; Kelebogile watches, listens, and replies by chat or voice note. George's **End Session** button has Agron summarise the session into the chat — and into both inboxes. |
| **Presence pill** | A live pill in the header shows when the other member is online, and each "came online" moment can trigger an email alert (see below). |
| **Sessions & Timetable** | Named sessions, weekly timetable, one-click **Add to Google Calendar** reminders, optional embedded shared Google Calendar. |
| **Study Hub** | From any uploaded file Agron generates **NSC summary notes**, **flashcards**, and **practice quizzes** — and the **Page-by-Page** mode walks Kelebogile through a document section by section, even when George is offline. |
| **Email notifications** | Transactional email via Brevo: presence alerts, session summaries, study reminders, accountability nudges, and weekly reports (details below). |

---

## Architecture

```
GitHub repo ──push──▶ Vercel (React SPA)
                           │
                           ▼
                     Supabase project
   ┌───────────────┬───────────────┬────────────────┬─────────────────┐
   Auth (2 users)  Postgres + RLS  Realtime         Storage (files)   Edge Functions (Deno)
                   7 tables        messages/classroom/sessions         ask-ai · extract-file-text · study-tools
                   (incl. email_log)                                  notify-presence · session-summary · daily-digest
                                                                             │
                                                                             ▼
                                                              DeepSeek API (secret) · Brevo API (secret)
```

See `ARCHITECTURE.md` for the full contract and `supabase/README.md` for backend details.

---

## Deployment Guide (≈ 30 minutes)

### 1 — Supabase
1. Create a free project at [supabase.com](https://supabase.com) (region closest to South Africa).
2. In the **SQL Editor**, paste and run the whole of `supabase/schema.sql`.
3. **Authentication → Users → Add user** — create BOTH users with *Auto Confirm User* ON and strong passwords:
   - `youngagripreneurs.ng@gmail.com` (George — teacher)
   - `youngagripreneursdev@gmail.com` (Kelebogile — learner)
4. **Authentication → Sign In / Providers**: disable *Allow new users to sign up* (the gate is now sealed — anyone else is rejected by the database trigger even if they tried).
5. Deploy the edge functions and set the DeepSeek secret:
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase functions deploy ask-ai
   supabase functions deploy extract-file-text
   supabase functions deploy study-tools
   supabase functions deploy notify-presence
   supabase functions deploy session-summary
   supabase functions deploy daily-digest
   supabase secrets set DEEPSEEK_API_KEY=sk-your-deepseek-key
   ```
   For the email functions (Brevo secrets + `CRON_SECRET` + the pg_cron schedule in `supabase/cron.sql`), follow `supabase/README.md` §9 — see *Email notifications (Brevo)* below.
6. Note your **Project URL** and **anon public key** (Project Settings → API).

### 2 — GitHub
```bash
cd young-agripreneurs-1-tutor
git init && git add -A && git commit -m "Young Agripreneurs 1 Tutor"
git branch -M main
git remote add origin https://github.com/<you>/young-agripreneurs-1-tutor.git
git push -u origin main
```

### 3 — Vercel
1. [vercel.com](https://vercel.com) → **Add New → Project** → import the GitHub repo (framework preset: **Vite** — auto-detected; no build settings to change).
2. Add Environment Variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
   - *(optional)* `VITE_GCAL_ID` = a Google Calendar ID to embed on the Sessions page (make the calendar public or shared with both users)
3. Deploy. Open the URL, sign in as George or Kelebogile — *curtains up.*

> Without the env vars the site shows a branded setup screen instead of crashing — safe to preview anytime.

---

## Email notifications (Brevo)

Transactional email keeps both members in the loop even when the app is closed, sent via [Brevo](https://www.brevo.com) and logged to the `email_log` table for cooldowns and dedupe:

- **Presence alerts** — when George or Kelebogile comes online, the other gets a "just came online — the stage is calling" email (3-hour cooldown).
- **Session summaries** — George's **End Session** button has Agron summarise the session; the summary lands in the chat *and* in both inboxes.
- **Daily study reminders + streaks** — a warm daily reminder to Kelebogile (CC George) with the current study streak and today/tomorrow's sessions.
- **Accountability nudges** — an evening check: a "the stage was dark today" note to both if there was no activity, otherwise a well-done note to Kelebogile and an activity recap for George.
- **Session-start reminders** — emailed to both about an hour before a scheduled session begins (deduped per session).
- **Weekly progress reports** — an Agron-written Sunday report covering topics, study activity, encouragement, and next week's focus.

Setup (Brevo account, secrets, edge function deployment, and the pg_cron schedule in `supabase/cron.sql`): see `supabase/README.md` §9.

---

## How a lesson flows

1. **Before**: George schedules a session (Kelebogile clicks *Add to Google Calendar* for the reminder) and uploads files to the Vault — Agron reads them automatically.
2. **During**: George opens the **Live Stage**, uploads/pastes a slide, hits **Go Live** and talks; Kelebogile watches, listens, asks in chat or by voice note. Stuck? Type `@ai why is photosynthesis…` and Agron joins in.
3. **After / solo study**: Kelebogile opens the **Study Hub** → generates notes, drills flashcards, takes a quiz, or lets Agron walk her through a document page by page.

## Security notes
- DeepSeek and Brevo keys live only in Supabase secrets — never in the frontend or git.
- Every table has Row Level Security; only the two profiles can read/write anything.
- AI messages can only be written by the edge function (service role) — nobody can forge them.
- All user/AI HTML is sanitized (DOMPurify) before rendering.
- `daily-digest` is locked behind a `CRON_SECRET` bearer token; `email_log` is service-role only.

## Local development
```bash
cp .env.example .env.local   # fill in your Supabase values
npm install
npm run dev
```

---

*Made with love for Kelebogile — break a leg at the NSC!*
