// TypeScript interfaces matching the ARCHITECTURE.md §2 schema exactly.

export type Role = 'teacher' | 'student';
export type SenderRole = 'teacher' | 'student' | 'ai';
export type MessageStatus = 'sent' | 'delivered' | 'read';
export type StudyKind = 'notes' | 'flashcards' | 'quiz';

// --- Telegraph Engine (TELEGRAPH_SPEC.md) ---

export type TelegraphTool = 'pen' | 'eraser' | 'clear';

/** One recorded stroke. `t` = ms offset from recording start; coords normalized 0–1. */
export interface TelegraphStroke {
  t: number;
  tool: TelegraphTool;
  color: string;
  size: number;
  pts: [number, number][];
}

/** The JSON Telegraph Script stored in the `telegraph` bucket. */
export interface TelegraphScriptData {
  version: 1;
  width: number;
  height: number;
  durationMs: number;
  strokes: TelegraphStroke[];
}

export interface TelegraphScriptRow {
  id: string;
  tutor_id: string | null;
  title: string;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  duration_ms: number | null;
  audio_path: string | null;
  script_path: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface Broadcast {
  id: string;
  script_id: string;
  airs_at: string;
  title: string | null;
  created_by: string | null;
  approved?: boolean;
  created_at: string;
  telegraph_scripts?: TelegraphScriptRow | null;
}

// --- Quizzes + Vuka Points (Phase 2) ---

export interface Quiz {
  id: string;
  script_id: string | null;
  tutor_id: string | null;
  title: string;
  created_at: string;
}

/** Public question shape — correct_index is never returned to clients. */
export interface QuizQuestionPublic {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  position: number;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  score_pct: number;
  vp_awarded: number;
  created_at: string;
}

export interface VpLedgerEntry {
  id: string;
  tutor_id: string;
  student_id: string | null;
  quiz_id: string | null;
  amount: number;
  reason: string;
  created_at: string;
}

export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export interface PayoutRequest {
  id: string;
  tutor_id: string;
  period: string;
  vp_total: number;
  amount_cents: number;
  status: PayoutStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// --- Varsity Engine (Phase 4: paid sessions + manual EFT) ---

export interface VarsityOffering {
  id: string;
  tutor_id: string;
  title: string;
  subject: string | null;
  description: string | null;
  price_cents: number;
  duration_min: number;
  active: boolean;
  approved?: boolean;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

export type BookingStatus =
  | 'pending_payment'
  | 'pending_review'
  | 'confirmed'
  | 'rejected'
  | 'cancelled';

export interface Booking {
  id: string;
  offering_id: string;
  learner_id: string;
  scheduled_at: string;
  status: BookingStatus;
  reference: string;
  jitsi_room: string;
  learner_needs: string | null;
  created_at: string;
  varsity_offerings?: VarsityOffering | null;
}

export interface Payment {
  id: string;
  payer_id: string;
  booking_id: string;
  amount_cents: number;
  proof_path: string;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  bookings?: Booking | null;
  profiles?: { email: string; full_name: string | null } | null;
}

export interface BankDetails {
  account_name: string;
  bank: string;
  account_number: string;
  branch_code: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  suspended?: boolean;
  subjects?: string[] | null;
  tutor_modes?: TeachingMode[];
  active_mode?: TeachingMode;
  deactivated_at?: string | null;
  welcome_code?: string | null;
  code_verified?: boolean;
  code_attempts?: number;
  whatsapp_number?: string | null;
  whatsapp_code_requested?: boolean;
  verification_note?: string | null;
  safe_room?: boolean;
  library_hold_until?: string | null;
  library_hold_reason?: string | null;
  created_at: string;
}

// --- Tutor screening (Phase 6) ---

export type TeachingMode = 'highschool' | 'varsity';
export type ApplicationStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected';
export type SectionVerdict = 'pending' | 'approved' | 'needs_fix';

export interface TutorApplication {
  id: string;
  user_id: string;
  status: ApplicationStatus;
  about: { province?: string; languages?: string[]; phone?: string };
  motivation: { why_tutor?: string; experience?: string };
  subjects: { highschool?: string[]; varsity?: string[] };
  availability: Record<string, string[]>;
  video_url: string | null;
  section_status: Record<string, SectionVerdict>;
  section_notes: Record<string, string>;
  ai_summary: string | null;
  ai_score: number | null;
  subject_test_subject: string | null;
  subject_test_score: number | null;
  subject_test_passed: boolean;
  subject_test_at: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null; email: string } | null;
}

export interface TutorDocument {
  id: string;
  application_id: string;
  user_id: string;
  kind: 'id_document' | 'transcript';
  file_path: string;
  status: 'pending' | 'approved' | 'rejected' | 'superseded';
  reject_reason: string | null;
  version: number;
  created_at: string;
}

// --- 30-mark screening tests (Phase 11) ---

/** Tutor-safe shape (my_screening_tests view): no scores, answers or comments. */
export interface ScreeningTestSafe {
  id: string;
  application_id: string;
  track: 'school' | 'varsity';
  subject: string;
  level_label: string;
  attempt_no: 1 | 2;
  questions: string[];
  overview_topic: string;
  status: 'in_progress' | 'marked' | 'expired';
  created_at: string;
  submitted_at: string | null;
  expires_at: string | null;
  /** Feedback band shown to tutors instead of a numeric score. */
  band: 'strong' | 'satisfactory' | 'developing' | null;
}

/** CEO/admin shape (full row, including hidden scores and comments). */
export interface ScreeningTestFull extends ScreeningTestSafe {
  tutor_id: string;
  answers: string[] | null;
  overview_answer: string | null;
  marks: number[] | null;
  overview_mark: number | null;
  total_score: number | null;
  marker_comment: string | null;
  ceo_comment: string | null;
}

export interface Message {
  id: string;
  sender_id: string | null; // null for AI
  sender_role: SenderRole;
  text: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  audio_url: string | null;
  status: MessageStatus;
  created_at: string;
}

export interface FileRow {
  id: string;
  uploader_id: string | null;
  file_name: string | null;
  file_url: string | null;
  storage_path: string | null;
  file_type: string | null;
  size_bytes: number | null;
  subject: string | null;
  extracted_text: string | null;
  created_at: string;
}

export interface Classroom {
  id: number; // single row id=1
  current_slide_url: string | null;
  current_slide_type: string | null;
  live_audio_url: string | null;
  live_audio_seq: number;
  updated_at: string;
}

export interface Session {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  start_at: string;
  end_at: string;
  location: string;
  created_by: string | null;
  created_at: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: string;
  explanation: string;
}

export type StudyContent =
  | { markdown: string }
  | Flashcard[]
  | { questions: QuizQuestion[] }
  | Record<string, unknown>;

export interface StudyMaterial {
  id: string;
  file_id: string | null;
  kind: StudyKind;
  title: string | null;
  content: StudyContent;
  created_by: string | null;
  created_at: string;
}

// --- Management team (Phase 9) ---

export interface ManagerChatMessage {
  id: string;
  manager_key: string;
  sender: 'ceo' | 'manager';
  text: string;
  created_at: string;
}

export interface Complaint {
  id: string;
  reporter_id: string;
  category: 'tutoring' | 'payments' | 'technical' | 'conduct' | 'other';
  audience: 'hr' | 'learner_success';
  subject: string;
  body: string;
  status: 'open' | 'in_progress' | 'resolved';
  hr_notes: string | null;
  quality_comment: string | null;
  ceo_comment: string | null;
  flag_for_meeting: boolean;
  meeting_target: 'tutors' | 'learners' | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string; role: string } | null;
}

export interface StaffPost {
  id: string;
  author_key: string;
  author_name: string;
  audience: 'all' | 'tutors' | 'learners';
  kind: 'daily_talk' | 'meeting' | 'announcement';
  body: string;
  created_at: string;
}

export interface ManagerReport {
  id: string;
  manager_key: string;
  title: string;
  body: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface SecurityEvent {
  id: string;
  user_id: string;
  signal: string;
  detail: Record<string, unknown>;
  severity: 'watch' | 'hold' | 'critical';
  status: 'open' | 'survey_sent' | 'cleared' | 'escalated';
  emailed_at: string | null;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
  profiles?: { full_name: string | null; email: string } | null;
}

export interface LibraryChat {
  id: string;
  user_id: string;
  sender: 'member' | 'agent';
  text: string;
  created_at: string;
}
