# ARCHITECTURE CONTRACT — Young Agripreneurs 1 Tutor
All agents MUST build against this contract exactly. Do not rename tables, columns, files, or env vars.

## 0. Stack
- Frontend: Vite + React 18 + TypeScript + Tailwind CSS v3, deployed on Vercel (SPA, `vercel.json` rewrites → /index.html).
- Backend: Supabase (Auth, Postgres, Realtime, Storage, Edge Functions / Deno).
- AI: DeepSeek `deepseek-chat` via Supabase Edge Functions (key stored as Supabase secret `DEEPSEEK_API_KEY`, NEVER in frontend).
- Repo: GitHub → auto-deploy to Vercel. Env vars on Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## 1. Users & Auth (HARD GATE)
Only two accounts may exist/enter:
- Teacher "George": `youngagripreneurs.ng@gmail.com` (role `teacher`)
- Learner "Kelebogile": `youngagripreneursdev@gmail.com` (role `student`)
- Accounts are created manually in Supabase dashboard (sign-ups DISABLED in Supabase Auth settings).
- Frontend: after login, fetch `profiles` row; if email not in allow-list → sign out immediately + show "Access denied".
- Backend: RLS on every table checks `auth.uid()` maps to a profiles row (only 2 exist).
- Frontend role from `profiles.role`; teacher-only UI is cosmetic — RLS enforces real rules.

## 2. Database Schema (public schema)
```sql
profiles:        id uuid pk references auth.users, email text unique, full_name text, role text check (role in ('teacher','student')), created_at timestamptz default now()
messages:        id uuid pk default gen_random_uuid(), sender_id uuid references profiles(id) (null for AI), sender_role text check (in ('teacher','student','ai')), text text, file_url text, file_name text, file_type text, audio_url text, status text default 'sent' check (in ('sent','delivered','read')), created_at timestamptz default now()
files:           id uuid pk default gen_random_uuid(), uploader_id uuid references profiles(id), file_name text, file_url text, storage_path text, file_type text, size_bytes bigint, subject text, extracted_text text, created_at timestamptz default now()
classroom:       id int pk default 1, current_slide_url text, current_slide_type text, live_audio_url text, live_audio_seq int default 0, updated_at timestamptz default now()  -- single row id=1
sessions:        id uuid pk default gen_random_uuid(), title text not null, description text, subject text, start_at timestamptz not null, end_at timestamptz not null, location text default 'Online — Live Stage', created_by uuid references profiles(id), created_at timestamptz default now()
study_materials: id uuid pk default gen_random_uuid(), file_id uuid references files(id), kind text check (in ('notes','flashcards','quiz')), title text, content jsonb, created_by uuid references profiles(id), created_at timestamptz default now()
```
- Enable Realtime for `messages`, `classroom`, `sessions`.
- RLS enabled on ALL tables. Policies: `authenticated` users whose id exists in `profiles` can SELECT/INSERT; UPDATE/DELETE limited (teacher can update/delete sessions & classroom; users can update message.status for read receipts; only uploader or teacher can delete files).
- AI messages: inserted by Edge Function using service role (bypasses RLS); sender_id null, sender_role 'ai'.
- Storage: single bucket `files`, PRIVATE=false (public read) for simplicity of preview/download URLs — protected by obscure paths + app gate; upload policy: authenticated profiles members only. Paths: `vault/<timestamp>_<name>`, `chat/<timestamp>_<name>`, `voice/<timestamp>.webm`, `slides/<timestamp>_<name>`, `live/<seq>.webm`.

## 3. Edge Functions (Deno, supabase/functions/)
All: verify `Authorization: Bearer <user JWT>` via `supabase.auth.getUser()`, reject 401 otherwise; check user in allow-list emails; CORS headers for browser invoke.

### ask-ai  (POST)
Body: `{ message: string, history?: {role,content}[], fileContext?: string }`
- Fetches last 30 messages from `messages` itself (server-side, service role) → builds history (never trust client history blindly).
- If `fileContext` absent but recent messages reference a file, include that file's `extracted_text` (truncated ~12k chars).
- System prompt: Agron, elite Grade 11/12 NSC tutor, third participant in chat between George (teacher) & Kelebogile (learner); concise, structured, markdown, encouraging; helps teacher explain, helps learner understand; NSC exam focus.
- Calls DeepSeek, inserts reply into `messages` (sender_role 'ai') via service role, returns `{ reply }`.

### extract-file-text (POST)
Body: `{ fileId: string }` — looks up `files` row, downloads from storage, extracts text:
- `.txt/.md` → plain read; `.pdf` → parse via `pdfjs-dist` (esm.sh); `.docx` → unzip + parse `word/document.xml` (regex strip tags is acceptable); else → return `{ ok:false }`.
- Updates `files.extracted_text` (truncate 50k chars). Returns `{ ok, chars }`.

### study-tools (POST)
Body: `{ mode: 'notes'|'flashcards'|'quiz'|'page_by_page', fileId: string, page?: number, question?: string }`
- Loads `files.extracted_text` (auto-invoke extraction logic inline if missing).
- `notes`: NSC-style summary notes (markdown) → saved to `study_materials` (kind notes, content {markdown}).
- `flashcards`: JSON array `[{front, back}]` ×15 → saved (kind flashcards).
- `quiz`: JSON `{questions:[{q, options[4], answer, explanation}]}` ×10 NSC-style → saved (kind quiz).
- `page_by_page`: splits text into ~1200-char "pages"; returns `{ page, totalPages, explanation }` where explanation is DeepSeek's learner-friendly walkthrough of that page (Kelebogile-focused, acting analogies welcome); optional `question` about the page is answered.
- Returns JSON result (and saved id where applicable).

## 4. Frontend File Map (src/)
```
src/main.tsx, src/App.tsx (router), src/index.css (theme)
src/lib/supabase.ts        — client; reads import.meta.env; exports `supabaseConfigured` bool
src/lib/types.ts           — TS types matching schema exactly
src/lib/auth.tsx           — AuthProvider (session, profile, role, signIn, signOut, allow-list check)
src/lib/utils.ts           — formatting, gcalLink(session), classNames
src/components/Layout.tsx  — app shell: top bar (logo, nav tabs, user chip, sign out) + <Outlet/>
src/components/SetupScreen.tsx — shown when supabase not configured
src/pages/Login.tsx        — theatre-door login
src/pages/Classroom.tsx    — 3-panel: Vault | Live Stage | Chat (the default home "/")
src/pages/Sessions.tsx     — sessions CRUD + weekly timetable + Google Calendar embed + "Add to Google Calendar"
src/pages/StudyHub.tsx     — file picker → generate notes/flashcards/quiz; page-by-page reader mode
src/features/chat/*        — ChatPanel, MessageBubble (ticks ✓/✓✓/blue), VoiceRecorder, Markdown renderer, @ai trigger, typing indicator
src/features/vault/*       — FileVault (upload drag&drop, list, preview modal, download)
src/features/stage/*       — LiveStage (teacher: upload/paste slide, prev/next for PDF images, Go-Live audio broadcast; student: view + auto-play live audio)
src/features/sessions/*    — SessionForm, Timetable, CalendarEmbed
src/features/study/*       — StudyGenerator, FlashcardDeck, QuizRunner, PageReader
```
Routes: `/login`, `/` (Classroom), `/sessions`, `/study`. All except /login wrapped in auth guard (redirect to /login).

## 5. Design System (theatre dream theme — for Kelebogile, aspiring actress)
- Name in UI: "Young Agripreneurs 1 Tutor"; AI persona name: **Agron**.
- Mood: opening night at the theatre — deep warm charcoal-aubergine backgrounds (#17111c, #1f1626), warm gold/amber accents (#e8b34b, #f5d08a), curtain crimson (#a63d40) sparingly, cream text (#f7f0e3). NO blue-purple gradients, NO high-saturation backgrounds.
- Fonts (Google): "Playfair Display" (headings, theatrical serif), "Inter" (body), "JetBrains Mono" (labels/meta).
- Motifs: spotlight glows (radial-gradient, low opacity), curtain textures on login, "stage" framing on Live Stage, ticket-stub cards for sessions, playbill styling for Study Hub.
- Generated assets (in public/assets/): `login-backdrop.png` (grand theatre stage, golden spotlight, red curtains, cinematic), `empty-stage.png` (empty stage with single spotlight), used in login + stage-empty states.

## 6. Key Behaviours
- Read ticks: on receiving view, client sets messages.status='read' where sender != me and status != 'read' → realtime UPDATE re-renders sender's ticks blue ✓✓. Show ✓ (sent), ✓✓ (delivered — set when any client receives INSERT), blue ✓✓ (read).
- @ai: message containing `@ai` (any case) → after insert, client invokes `ask-ai`; show temporary "Agron is thinking…" bubble (local state, replaced on ai INSERT via realtime).
- File upload → after `files` insert, fire-and-forget invoke `extract-file-text`.
- Live audio: teacher clicks Go Live → MediaRecorder, every 4s chunk uploaded to `live/<seq>.webm`, classroom row updated {live_audio_url, live_audio_seq}; student's client watches classroom updates, auto-plays new seq. Stop Live → clear fields.
- Google Calendar: each session renders "Add to Google Calendar" (https://calendar.google.com/calendar/render?action=TEMPLATE&text=..&dates=../..&details=..&location=..) + Sessions page embeds `https://calendar.google.com/calendar/embed?src=<VITE_GCAL_ID>` if env set (optional).
- Setup screen: if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` missing → render branded SetupScreen (no crash) listing required env vars.

## 7. Security Rules
- DeepSeek key ONLY in Supabase secrets. Frontend uses anon key + RLS only.
- Escape/sanitize all user text rendered as HTML: markdown renderer must sanitize (use `marked` + `dompurify`).
- No service-role key anywhere in frontend. No secrets in git (`.env.example` only).
- Validate file types/sizes on upload (max 25MB; allow pdf/docx/pptx/txt/md/images/audio).


---

# UPDATE WAVE 2 — Brevo Email System + Icon Policy (binding, same force as above)

## 8. Secrets (ALL in Supabase secrets — none in frontend, none in git)
- `DEEPSEEK_API_KEY` (already) — AI.
- `BREVO_API_KEY` — Brevo transactional email API key (xkeysib-...).
- `BREVO_SENDER_EMAIL` — verified sender address in Brevo account.
- `BREVO_SENDER_NAME` — e.g. "Young Agripreneurs 1 Tutor".
- `CRON_SECRET` — random string; protects the scheduled function from public invocation.
Set with: `supabase secrets set BREVO_API_KEY=... BREVO_SENDER_EMAIL=... BREVO_SENDER_NAME="Young Agripreneurs 1 Tutor" CRON_SECRET=...`

## 9. New table: email_log
```sql
email_log: id uuid pk default gen_random_uuid(), kind text not null, recipient text not null,
           subject text, meta jsonb default '{}', created_at timestamptz default now()
```
- RLS enabled, NO client policies (service-role only). Used for cooldowns + audit.

## 10. New edge functions (all Deno, same JWT+allow-list verification as existing, CORS handled)
Shared helper `supabase/functions/_shared/brevo.ts`: `sendBrevoEmail({ to: [{email, name}], subject, htmlContent, textContent? })` → POST https://api.brevo.com/v3/smtp/email with header `api-key: BREVO_API_KEY`, sender from secrets; throws on non-2xx; logs to email_log (service role).

### notify-presence (POST, body: {})
- Called by a signed-in member right after they come online. Server identifies caller via JWT, determines the OTHER member (teacher↔student from profiles), checks email_log for same `kind='presence'` + same recipient within 3 hours → if found, return { sent:false, reason:'cooldown' }.
- Else emails the other member: "Kelebogile just came online — join the stage" (or George variant) with a link to the app URL (env `APP_PUBLIC_URL`, optional secret; fallback text without link). Logs email_log. Returns { sent:true }.

### session-summary (POST, body: {})
- Callable by either member (typically teacher's "End Session" button). Fetches last 120 messages; if < 3 human messages, return { ok:false, reason:'not enough activity' }.
- DeepSeek generates: session title, what was covered (bullets), key takeaways for Kelebogile, homework/next steps, one encouraging line. STRICT JSON.
- Inserts the summary into `messages` as an AI message (markdown) so it lives in the chat.
- Emails Kelebogile (full summary, kind='summary') and George (copy, kind='summary'). Returns { ok:true, title }.

### daily-digest (POST, auth: `Authorization: Bearer <CRON_SECRET>` ONLY — no user JWT)
Modes via body `{ mode: 'reminder' | 'accountability' | 'session_check' | 'weekly' }`, run by pg_cron (see supabase/cron.sql):
- `reminder` (daily 15:00 SAST): warm study reminder to Kelebogile (CC George) with current streak = consecutive days with any messages/study_materials activity, and today/tomorrow's upcoming sessions.
- `session_check` (every 15 min): sessions starting in 55–70 min → reminder email to both (kind='session_reminder', dedupe via email_log meta session_id).
- `accountability` (daily 19:30 SAST): if zero human messages AND zero study_materials today → accountability email to BOTH ("the stage was dark today…"); if there WAS activity → short "well done" note to Kelebogile + activity recap to George (messages count, files uploaded, study materials generated).
- `weekly` (Sunday 18:00 SAST): DeepSeek-written weekly progress report from the week's messages + study_materials (topics covered, quiz activity, streak, encouragement + next-week focus) to both.
All emails logged. Brevo free tier = 300 emails/day; this design sends ≤ ~6/day.

## 11. Cron schedule — `supabase/cron.sql`
pg_cron + pg_net statements POSTing to the daily-digest function URL with Bearer CRON_SECRET at the times above (UTC-adjusted, SAST = UTC+2), with `select cron.schedule(...)` idempotency notes in comments.

## 12. Frontend changes
- **Icon policy: NO emojis anywhere in UI.** Use `lucide-react` (add dependency) for all icons (file types, ticks stay as text glyphs ✓ — ticks are characters not emojis, keep them; LIVE badge uses a Lucide `Radio`/`Circle` icon; wordmark uses `Drama` or `Theater` icon instead of 🎭; remove 👋🔴🎭⭐ etc.).
- **Presence**: supabase presence channel `online-classroom`; each client tracks itself on connect. When MY track succeeds AND it's my first connect of the session → invoke `notify-presence` once (fire-and-forget; server cooldown handles duplicates). Show a small presence indicator in Layout: green dot + "George online" / "Kelebogile online" when the other party's presence state is present (Lucide `Circle` filled).
- **LiveStage teacher**: "End Session" button (Lucide `Flag`/`CheckCircle`) → confirm → invoke `session-summary` → inline success/error text; the AI summary arrives in chat via realtime.
- No other behaviour changes.


---

# UPDATE WAVE 3 — Performance, Professional Tone, Multilingual, Brighter Palette (binding)

## 13. Performance & Mobile
- **Route-level code splitting**: every page (`Classroom`, `Sessions`, `StudyHub`, sub-pages) loaded via `React.lazy` + `<Suspense>` with a themed loading fallback. No route may pull another route's feature code into the initial bundle.
- **Split StudyHub into separate routes**: `/study` (overview + StudyGenerator) and `/study/reader` (PageReader) — the reader was freezing the hub; it becomes its own lazy chunk. Sessions may also get `/sessions` only (already light).
- **Classroom mobile nav**: on <lg screens keep the tab switcher (Stage | Chat | Files) but each panel mounts ONLY when its tab is active (unmount inactive panels to free memory, EXCEPT ChatPanel which may stay mounted to keep realtime subscriptions — use CSS hide for chat, unmount for vault/stage).
- No layout may exceed viewport height with nested scroll traps on mobile; test mentally at 360px width.

## 14. Professional tone
All user-facing copy becomes formal/professional. Examples of required rewrites:
- "The stage is dark — waiting for George" → "No presentation is currently active. Please wait for your teacher to begin."
- "Solo on stage" → "Offline" / presence pill: "George is online" / "Kelebogile is online" / "No one else is online".
- "Take the Stage" → "Sign In". Quiz tiers → formal ("Excellent result" / "Good progress" / etc.). Remove all theatre-metaphor copy from UI strings (branding name stays). Empty states: short, helpful, formal.

## 15. Multilingual AI (Google-Translate-backed UI + AI languages)
- Supported languages: English (en), Afrikaans (af), Setswana (tn), Sepedi (nso), isiZulu (zu).
- **AI language**: a `LanguageProvider` in `src/lib/language.tsx` — stores choice in localStorage (`ya1t_lang`), default 'en'. A selector (Lucide `Languages` icon) in the Layout top bar, visible to BOTH users (primary beneficiary is Kelebogile).
- Contract change: `ask-ai`, `study-tools` (all modes incl. page_by_page), `session-summary` accept optional `language` in the POST body (BCP-47 code). When present and != 'en', the system/user prompt adds: "Respond entirely in <language name>. Keep technical terms clear; if a concept has no common translation, give the English term in brackets." Frontend passes the current language in every invoke. DeepSeek handles the translation itself.
- **Google Translate for static UI**: add the Google Translate Website widget (translate.google.com/translate_a/element.js) loaded lazily ONLY when the user picks a non-English UI language, targeting page content (mark `notranslate` on code/math blocks). It covers af/tn?/nso?/zu — for languages the widget lacks (tn, nso may be missing), the AI-language path still works; note this limitation in code comments. Keep the widget visually minimal/styled to match theme.
- Emails (Brevo) stay in English except session-summary, which includes the summary in the user's language when language != 'en' (pass language in the session-summary invoke).

## 16. New palette — "Golden Ratio" light theme
Replace the dark aubergine theme with a bright, warm, golden-ratio-inspired palette:
- Base background: warm ivory `#faf6ee` / `#f5efe1` (light!)
- Panels/cards: white `#ffffff` with warm sand borders `#e8ddc4`
- Primary accent: golden amber `#c9992e` (buttons, highlights), deeper gold `#a07c1f` for hover
- Secondary: soft olive-sage `#7d8c5c` (success, presence online dot stays emerald) and terracotta `#b4664a` for warnings/LIVE
- Text: deep umber `#3a2f1d` (headings), warm grey-brown `#6b5d43` (body)
- Proportions: apply golden-ratio spacing rhythm (e.g. section gaps 21px/34px/55px scale) where reasonable.
- Keep Lucide icons, Playfair Display headings + Inter body. Update `tailwind.config.js` tokens and `src/index.css` (all `.btn-gold`, `.card-playbill`, `.input-stage`, `.spotlight` etc. become light-theme variants — spotlight becomes a soft golden radial glow on ivory).
- Login page keeps the theatre backdrop image but with a light overlay treatment (soft ivory veil) + light card. Empty-state image may remain but presented in a light frame.
- NO dark-mode-depressing feel: the app must feel bright, warm, hopeful.

## 17. What must NOT regress
Auth gate, RLS, ticks, voice notes, presence + notify-presence invoke, End Session → session-summary (now with language), cron emails, no emojis (Lucide only), safeUrl, DOMPurify sanitization, SetupScreen when env missing. All edge-function secrets stay server-side. Dashboard-deploy copies of changed functions must be regenerated in sync.
