// =============================================================================
// VukaTV curriculum catalogue — South African school subjects (DBE / CAPS)
//
// Grades 8–9 follow the GET (General Education and Training) phase.
// Grades 10–12 follow the FET phase and write the National Senior
// Certificate (NSC) examinations. The subject names below follow the
// official DBE examination subject list.
//
// STREAM_SUGGESTIONS are guidance only — learners and tutors may mix
// subjects freely across combinations (e.g. Agricultural Sciences with
// Physical Sciences, or Geography with Business Studies).
// =============================================================================

export const SCHOOL_GRADES = [8, 9, 10, 11, 12] as const;

export type SubjectCategory = { name: string; subjects: string[] };

const OFFICIAL_LANGUAGES = [
  'Afrikaans', 'English', 'isiNdebele', 'isiXhosa', 'isiZulu', 'Sepedi',
  'Sesotho', 'Setswana', 'Siswati', 'Tshivenda', 'Xitsonga',
];

/** Grades 8–9 (GET phase). */
export const GET_SUBJECTS: SubjectCategory[] = [
  {
    name: 'Languages — Home Language',
    subjects: OFFICIAL_LANGUAGES.map((l) => `${l} Home Language`),
  },
  {
    name: 'Languages — First Additional Language',
    subjects: OFFICIAL_LANGUAGES.map((l) => `${l} First Additional Language`),
  },
  {
    name: 'Core subjects',
    subjects: [
      'Mathematics',
      'Natural Sciences',
      'Social Sciences (Geography & History)',
      'Technology',
      'Economic & Management Sciences',
      'Life Orientation',
      'Creative Arts',
    ],
  },
];

/** Grades 10–12 (FET phase / NSC examinations) — full DBE list. */
export const FET_SUBJECTS: SubjectCategory[] = [
  {
    name: 'Languages — Home Language',
    subjects: [...OFFICIAL_LANGUAGES.map((l) => `${l} Home Language`), 'South African Sign Language Home Language'],
  },
  {
    name: 'Languages — First Additional Language',
    subjects: OFFICIAL_LANGUAGES.map((l) => `${l} First Additional Language`),
  },
  {
    name: 'Languages — Second Additional Language',
    subjects: [
      ...OFFICIAL_LANGUAGES.map((l) => `${l} Second Additional Language`),
      'Arabic Second Additional Language',
      'French Second Additional Language',
      'German Second Additional Language',
      'Gujarati Second Additional Language',
      'Hebrew Second Additional Language',
      'Hindi Second Additional Language',
      'Italian Second Additional Language',
      'Latin Second Additional Language',
      'Mandarin Second Additional Language',
      'Modern Greek Second Additional Language',
      'Portuguese Second Additional Language',
      'Punjabi Second Additional Language',
      'Serbian Second Additional Language',
      'Spanish Second Additional Language',
      'Tamil Second Additional Language',
      'Telugu Second Additional Language',
      'Urdu Second Additional Language',
    ],
  },
  {
    name: 'Mathematics',
    subjects: ['Mathematics', 'Mathematical Literacy', 'Technical Mathematics'],
  },
  {
    name: 'Sciences',
    subjects: [
      'Physical Sciences', 'Life Sciences', 'Agricultural Sciences',
      'Technical Sciences', 'Marine Sciences',
    ],
  },
  {
    name: 'Commerce',
    subjects: ['Accounting', 'Business Studies', 'Economics'],
  },
  {
    name: 'Human & Social Sciences',
    subjects: ['Geography', 'History', 'Religion Studies', 'Life Orientation'],
  },
  {
    name: 'Technology & Computing',
    subjects: [
      'Computer Applications Technology', 'Information Technology',
      'Engineering Graphics and Design', 'Civil Technology',
      'Electrical Technology', 'Mechanical Technology',
      'Agricultural Technology', 'Agricultural Management Practices',
    ],
  },
  {
    name: 'Services',
    subjects: ['Tourism', 'Hospitality Studies', 'Consumer Studies'],
  },
  {
    name: 'Arts & Culture',
    subjects: ['Dramatic Arts', 'Dance Studies', 'Design', 'Music', 'Visual Arts'],
  },
  {
    name: 'Maritime',
    subjects: ['Maritime Economics', 'Nautical Science'],
  },
];

/** Subjects available per grade. */
export function subjectsForGrade(grade: number): SubjectCategory[] {
  return grade <= 9 ? GET_SUBJECTS : FET_SUBJECTS;
}

/**
 * Common subject combinations ("streams") shown as suggestions only.
 * Learners are NOT locked into a stream — these exist so a learner who
 * wants "the science combination" can add it in one tap and still adjust.
 */
export const STREAM_SUGGESTIONS: { name: string; blurb: string; subjects: string[] }[] = [
  {
    name: 'Science',
    blurb: 'For medicine, engineering, and science degrees.',
    subjects: ['Mathematics', 'Physical Sciences', 'Life Sciences'],
  },
  {
    name: 'Commerce',
    blurb: 'For accounting, finance, and business degrees.',
    subjects: ['Accounting', 'Business Studies', 'Economics', 'Mathematics'],
  },
  {
    name: 'Humanities',
    blurb: 'For law, social sciences, and teaching.',
    subjects: ['History', 'Geography', 'Life Orientation'],
  },
  {
    name: 'Technical / Engineering',
    blurb: 'For technical colleges and engineering trades.',
    subjects: ['Technical Mathematics', 'Technical Sciences', 'Engineering Graphics and Design'],
  },
  {
    name: 'Agriculture',
    blurb: 'For agricultural sciences and agri-business.',
    subjects: ['Agricultural Sciences', 'Agricultural Management Practices', 'Life Sciences'],
  },
  {
    name: 'Hospitality & Tourism',
    blurb: 'For hospitality, tourism, and consumer studies.',
    subjects: ['Tourism', 'Hospitality Studies', 'Consumer Studies'],
  },
  {
    name: 'IT & Computing',
    blurb: 'For software and IT careers.',
    subjects: ['Information Technology', 'Computer Applications Technology', 'Mathematics'],
  },
  {
    name: 'Arts & Design',
    blurb: 'For creative and design careers.',
    subjects: ['Visual Arts', 'Design', 'Dramatic Arts', 'Music'],
  },
];
