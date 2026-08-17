// TypeScript interfaces matching the ARCHITECTURE.md §2 schema exactly.

export type Role = 'teacher' | 'student';
export type SenderRole = 'teacher' | 'student' | 'ai';
export type MessageStatus = 'sent' | 'delivered' | 'read';
export type StudyKind = 'notes' | 'flashcards' | 'quiz';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
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
