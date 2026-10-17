import { BookOpen, ExternalLink, X } from 'lucide-react';

/**
 * DBE past-paper launcher (Phase 3): opened by the diagonal arc-swipe or the
 * on-screen button. Links go to the official Department of Basic Education
 * past-exam-papers portals.
 */

const DBE_LINKS = [
  {
    label: 'NSC past examination papers',
    description: 'Grade 12 papers and memos, all subjects, recent years.',
    url: 'https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationpapers.aspx',
  },
  {
    label: 'Grade 11 past papers (Eastern Cape)',
    description: 'Provincial Grade 11 papers and memoranda.',
    url: 'https://www.ecexams.co.za/ExaminationPapers.htm',
  },
  {
    label: 'DBE website',
    description: 'Curriculum statements, circulars and announcements.',
    url: 'https://www.education.gov.za/',
  },
];

export default function PastPapersModal({
  subject,
  onClose,
}: {
  subject: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true">
      <div className="card-playbill w-full max-w-md p-6">
        <div className="flex items-start justify-between">
          <h2 className="font-display flex items-center gap-2 text-lg font-semibold text-ink">
            <BookOpen className="h-5 w-5 text-gold-deep" aria-hidden="true" />
            Past papers
          </h2>
          <button type="button" onClick={onClose} aria-label="Close past papers" className="text-ink-soft hover:text-ink">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {subject
            ? `Practise ${subject} with official past papers from the Department of Basic Education.`
            : 'Practise with official past papers from the Department of Basic Education.'}
        </p>
        <ul className="mt-4 space-y-2">
          {DBE_LINKS.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-md border border-sand bg-paper p-3 transition hover:border-gold hover:bg-gold/5"
              >
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-medium text-ink">{l.label}</span>
                  <span className="block text-xs text-ink-soft">{l.description}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-soft">
          Links open in a new tab on the official DBE and provincial exam sites.
        </p>
      </div>
    </div>
  );
}
