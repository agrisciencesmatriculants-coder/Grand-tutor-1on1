// =============================================================================
// VukaTV tertiary catalogue — South African university faculties, degrees and
// courses, named in the style of SA university faculty booklets (Wits model).
//
// Course names differ between universities (e.g. "Financial Accounting I" at
// Wits ≈ "ACC1006F" at UCT ≈ "Financial Accounting 178" at Stellenbosch), so
// courses are grouped by DEPARTMENT and labelled by year of study. A Rhodes
// student taking "Accounting 2" maps to the same department-year slot as a
// Wits or UCT student — tutors are screened on the department course, not on
// one university's internal code.
// =============================================================================

export type Course = { code: string; name: string; year: number; dept: string };
export type Degree = { name: string; years: number; courses: Course[] };
export type Faculty = { name: string; degrees: Degree[] };

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** Build a year-sequenced department course: ACCN1000 Financial Accounting I … */
function seq(dept: string, codePrefix: string, name: string, years: number[]): Course[] {
  return years.map((y, i) => ({
    code: `${codePrefix}${y}000`,
    name: `${name} ${ROMAN[i]}`,
    year: y,
    dept,
  }));
}

function one(dept: string, code: string, name: string, year: number): Course {
  return { code, name, year, dept };
}

// ---------------------------------------------------------------------------
// Faculty of Commerce, Law & Management
// ---------------------------------------------------------------------------

const COMMERCE: Faculty = {
  name: 'Commerce, Law & Management',
  degrees: [
    {
      name: 'BCom (Accounting)',
      years: 3,
      courses: [
        ...seq('Accounting', 'ACCN', 'Financial Accounting', [1, 2, 3]),
        ...seq('Accounting', 'ACCT', 'Taxation', [2, 3]),
        ...seq('Accounting', 'ACAU', 'Auditing', [2, 3]),
        ...seq('Accounting', 'ACMF', 'Management Accounting and Finance', [2, 3]),
        ...seq('Economics', 'ECON', 'Economics', [1, 2]),
        one('Commercial Law', 'CLAW1000', 'Commercial Law I', 1),
        one('Statistics', 'STAT1000', 'Business Statistics I', 1),
        one('Information Systems', 'ISYS1000', 'Business Information Systems I', 1),
      ],
    },
    {
      name: 'BCom (Economics)',
      years: 3,
      courses: [
        ...seq('Economics', 'ECON', 'Economics', [1, 2, 3]),
        ...seq('Statistics', 'STAT', 'Statistics', [1, 2]),
        ...seq('Mathematics', 'MATH', 'Mathematics', [1, 2]),
        one('Management', 'MGMT1000', 'Business Management I', 1),
        one('Accounting', 'ACCN1000', 'Financial Accounting I', 1),
      ],
    },
    {
      name: 'BCom (Finance)',
      years: 3,
      courses: [
        ...seq('Finance', 'FINE', 'Corporate Finance', [1, 2, 3]),
        ...seq('Accounting', 'ACCN', 'Financial Accounting', [1, 2]),
        ...seq('Economics', 'ECON', 'Economics', [1, 2]),
        one('Statistics', 'STAT1000', 'Business Statistics I', 1),
        one('Finance', 'FINE3001', 'Investment Analysis and Portfolio Management', 3),
      ],
    },
    {
      name: 'BCom (Information Systems)',
      years: 3,
      courses: [
        ...seq('Information Systems', 'ISYS', 'Information Systems', [1, 2, 3]),
        ...seq('Computer Science', 'COMS', 'Computer Science', [1, 2]),
        one('Management', 'MGMT1000', 'Business Management I', 1),
        one('Accounting', 'ACCN1000', 'Financial Accounting I', 1),
        one('Information Systems', 'ISYS3001', 'Systems Analysis and Design', 3),
      ],
    },
    {
      name: 'BCom (Management)',
      years: 3,
      courses: [
        ...seq('Management', 'MGMT', 'Business Management', [1, 2, 3]),
        ...seq('Economics', 'ECON', 'Economics', [1, 2]),
        one('Accounting', 'ACCN1000', 'Financial Accounting I', 1),
        one('Statistics', 'STAT1000', 'Business Statistics I', 1),
        one('Management', 'MGMT3001', 'Strategic Management', 3),
      ],
    },
    {
      name: 'BCom (Law)',
      years: 3,
      courses: [
        ...seq('Law', 'LAWS', 'Law for Commerce', [1, 2, 3]),
        ...seq('Economics', 'ECON', 'Economics', [1, 2]),
        one('Accounting', 'ACCN1000', 'Financial Accounting I', 1),
        one('Management', 'MGMT1000', 'Business Management I', 1),
      ],
    },
    {
      name: 'LLB',
      years: 4,
      courses: [
        one('Law', 'LAWS1001', 'Introduction to Law', 1),
        one('Law', 'LAWS1002', 'Law of Persons', 1),
        one('Law', 'LAWS1003', 'Constitutional Law', 1),
        one('Law', 'LAWS2001', 'Law of Contract', 2),
        one('Law', 'LAWS2002', 'Law of Delict', 2),
        one('Law', 'LAWS2003', 'Criminal Law', 2),
        one('Law', 'LAWS2004', 'Family Law', 2),
        one('Law', 'LAWS3001', 'Law of Property', 3),
        one('Law', 'LAWS3002', 'Law of Succession', 3),
        one('Law', 'LAWS3003', 'Labour Law', 3),
        one('Law', 'LAWS3004', 'Law of Evidence', 3),
        one('Law', 'LAWS4001', 'Civil Procedure', 4),
        one('Law', 'LAWS4002', 'Criminal Procedure', 4),
        one('Law', 'LAWS4003', 'Company Law', 4),
        one('Law', 'LAWS4004', 'Legal Practice and Ethics', 4),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Faculty of Engineering & the Built Environment
// ---------------------------------------------------------------------------

const engCore = (prefix: string): Course[] => [
  one('Mathematics', 'MATH1000', 'Engineering Mathematics I', 1),
  one('Physics', 'PHYS1000', 'Engineering Physics I', 1),
  one('Engineering', `${prefix}1001`, 'Engineering Design and Drawing', 1),
  one('Chemistry', 'CHEM1000', 'Engineering Chemistry I', 1),
];

const ENGINEERING: Faculty = {
  name: 'Engineering & the Built Environment',
  degrees: [
    {
      name: 'BSc(Eng) Civil Engineering',
      years: 4,
      courses: [
        ...engCore('CVEN'),
        ...seq('Civil Engineering', 'CVEN', 'Structural Analysis', [2, 3, 4]),
        ...seq('Civil Engineering', 'CVGE', 'Geotechnical Engineering', [2, 3]),
        one('Civil Engineering', 'CVEN2002', 'Fluid Mechanics I', 2),
        one('Civil Engineering', 'CVEN3002', 'Hydraulics and Water Engineering', 3),
        one('Civil Engineering', 'CVEN4002', 'Transportation Engineering', 4),
        one('Civil Engineering', 'CVEN4003', 'Structural Design Project', 4),
      ],
    },
    {
      name: 'BSc(Eng) Electrical Engineering',
      years: 4,
      courses: [
        ...engCore('ELEN'),
        ...seq('Electrical Engineering', 'ELEN', 'Circuit Theory', [2, 3]),
        ...seq('Electrical Engineering', 'ELES', 'Signals and Systems', [2, 3]),
        one('Electrical Engineering', 'ELEN2002', 'Digital Electronics', 2),
        one('Electrical Engineering', 'ELEN3002', 'Power Systems I', 3),
        one('Electrical Engineering', 'ELEN4001', 'Control Systems', 4),
        one('Electrical Engineering', 'ELEN4002', 'Capstone Design Project', 4),
      ],
    },
    {
      name: 'BSc(Eng) Mechanical Engineering',
      years: 4,
      courses: [
        ...engCore('MECH'),
        ...seq('Mechanical Engineering', 'MECH', 'Thermodynamics', [2, 3]),
        ...seq('Mechanical Engineering', 'MEMT', 'Mechanics of Materials', [2, 3]),
        one('Mechanical Engineering', 'MECH2002', 'Fluid Mechanics I', 2),
        one('Mechanical Engineering', 'MECH3002', 'Machine Design I', 3),
        one('Mechanical Engineering', 'MECH4001', 'Heat Transfer', 4),
        one('Mechanical Engineering', 'MECH4002', 'Capstone Design Project', 4),
      ],
    },
    {
      name: 'BSc(Eng) Chemical Engineering',
      years: 4,
      courses: [
        ...engCore('CHMT'),
        ...seq('Chemical Engineering', 'CHMT', 'Chemical Engineering Thermodynamics', [2, 3]),
        ...seq('Chemical Engineering', 'CHPR', 'Chemical Process Principles', [2, 3]),
        one('Chemical Engineering', 'CHMT3002', 'Reactor Design', 3),
        one('Chemical Engineering', 'CHMT4001', 'Process Design Project', 4),
        one('Chemical Engineering', 'CHMT4002', 'Plant Operation and Control', 4),
      ],
    },
    {
      name: 'BSc(Eng) Mining Engineering',
      years: 4,
      courses: [
        ...engCore('MINE'),
        ...seq('Mining Engineering', 'MINE', 'Mining Methods', [2, 3, 4]),
        one('Mining Engineering', 'MINE2002', 'Rock Mechanics I', 2),
        one('Mining Engineering', 'MINE3002', 'Mine Ventilation and Environment', 3),
        one('Mining Engineering', 'MINE4002', 'Mineral Economics and Valuation', 4),
      ],
    },
    {
      name: 'BSc(Eng) Industrial Engineering',
      years: 4,
      courses: [
        ...engCore('INDS'),
        ...seq('Industrial Engineering', 'INDS', 'Operations Research', [2, 3, 4]),
        one('Industrial Engineering', 'INDS2002', 'Work Study and Ergonomics', 2),
        one('Industrial Engineering', 'INDS3002', 'Production Planning and Control', 3),
        one('Industrial Engineering', 'INDS4002', 'Logistics and Supply Chain Design', 4),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Faculty of Health Sciences
// ---------------------------------------------------------------------------

const HEALTH: Faculty = {
  name: 'Health Sciences',
  degrees: [
    {
      name: 'MBChB (Medicine and Surgery)',
      years: 6,
      courses: [
        one('Anatomy', 'ANAT1000', 'Anatomy I', 1),
        one('Physiology', 'PHSL1000', 'Physiology I', 1),
        one('Biochemistry', 'BCHM1000', 'Medical Biochemistry I', 1),
        one('Anatomy', 'ANAT2000', 'Anatomy II', 2),
        one('Physiology', 'PHSL2000', 'Physiology II', 2),
        one('Microbiology', 'MICR2000', 'Medical Microbiology I', 2),
        one('Pathology', 'PATH3000', 'General Pathology I', 3),
        one('Pharmacology', 'PHRM3000', 'Pharmacology I', 3),
        one('Medicine', 'MED3001', 'Introduction to Clinical Medicine', 3),
        one('Medicine', 'MEDI4000', 'Internal Medicine I (Clinical Rotation)', 4),
        one('Surgery', 'SURG4000', 'General Surgery I (Clinical Rotation)', 4),
        one('Obstetrics', 'OBGY4000', 'Obstetrics and Gynaecology I (Clinical Rotation)', 4),
        one('Paediatrics', 'PAED5000', 'Paediatrics II (Clinical Rotation)', 5),
        one('Psychiatry', 'PSYC5000', 'Psychiatry II (Clinical Rotation)', 5),
        one('Family Medicine', 'FAMM5000', 'Family Medicine II (Clinical Rotation)', 5),
        one('Medicine', 'MEDI6000', 'Internal Medicine III (Final Rotation)', 6),
        one('Surgery', 'SURG6000', 'General Surgery III (Final Rotation)', 6),
        one('Family Medicine', 'FAMM6000', 'Community and Family Medicine III (Final Rotation)', 6),
      ],
    },
    {
      name: 'BPharm (Pharmacy)',
      years: 4,
      courses: [
        one('Chemistry', 'CHEM1000', 'Pharmaceutical Chemistry I', 1),
        one('Physiology', 'PHSL1000', 'Human Physiology I', 1),
        ...seq('Pharmacy', 'PHAR', 'Pharmaceutics', [2, 3, 4]),
        ...seq('Pharmacy', 'PHRM', 'Pharmacology', [2, 3, 4]),
        one('Pharmacy', 'PHAR4001', 'Pharmacy Practice and Law', 4),
      ],
    },
    {
      name: 'BSc (Nursing)',
      years: 4,
      courses: [
        one('Anatomy', 'ANAT1000', 'Anatomy for Nurses I', 1),
        one('Physiology', 'PHSL1000', 'Physiology for Nurses I', 1),
        ...seq('Nursing', 'NURS', 'Nursing Science', [1, 2, 3, 4]),
        one('Nursing', 'NURS3001', 'Community Health Nursing', 3),
        one('Nursing', 'NURS4001', 'Professional Practice and Ethics', 4),
      ],
    },
    {
      name: 'BSc (Physiotherapy)',
      years: 4,
      courses: [
        one('Anatomy', 'ANAT1000', 'Anatomy for Physiotherapy I', 1),
        one('Physiology', 'PHSL1000', 'Physiology for Physiotherapy I', 1),
        ...seq('Physiotherapy', 'PHTY', 'Physiotherapy Practice', [1, 2, 3, 4]),
        one('Physiotherapy', 'PHTY3001', 'Musculoskeletal Physiotherapy', 3),
        one('Physiotherapy', 'PHTY4001', 'Clinical Reasoning and Research', 4),
      ],
    },
    {
      name: 'BDS (Dentistry)',
      years: 5,
      courses: [
        one('Anatomy', 'ANAT1000', 'Head and Neck Anatomy I', 1),
        one('Physiology', 'PHSL1000', 'Physiology I', 1),
        one('Dentistry', 'DENT2000', 'Dental Materials I', 2),
        ...seq('Dentistry', 'DENT', 'Clinical Dentistry', [3, 4, 5]),
        one('Dentistry', 'DENT4001', 'Oral Surgery', 4),
        one('Dentistry', 'DENT5001', 'Community Dentistry', 5),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Faculty of Science
// ---------------------------------------------------------------------------

const SCIENCE: Faculty = {
  name: 'Science',
  degrees: [
    {
      name: 'BSc (Computer Science)',
      years: 3,
      courses: [
        ...seq('Computer Science', 'COMS', 'Computer Science', [1, 2, 3]),
        ...seq('Mathematics', 'MATH', 'Mathematics', [1, 2]),
        one('Computer Science', 'COMS2001', 'Data Structures and Algorithms', 2),
        one('Computer Science', 'COMS2002', 'Databases I', 2),
        one('Computer Science', 'COMS3001', 'Operating Systems', 3),
        one('Computer Science', 'COMS3002', 'Software Engineering', 3),
      ],
    },
    {
      name: 'BSc (Mathematics)',
      years: 3,
      courses: [
        ...seq('Mathematics', 'MATH', 'Mathematics', [1, 2, 3]),
        one('Mathematics', 'MATH1001', 'Algebra I', 1),
        one('Mathematics', 'MATH2001', 'Real Analysis', 2),
        one('Statistics', 'STAT1000', 'Statistics I', 1),
        one('Mathematics', 'MATH3001', 'Abstract Algebra', 3),
        one('Mathematics', 'MATH3002', 'Complex Analysis', 3),
      ],
    },
    {
      name: 'BSc (Physics)',
      years: 3,
      courses: [
        ...seq('Physics', 'PHYS', 'Physics', [1, 2, 3]),
        ...seq('Mathematics', 'MATH', 'Mathematics', [1, 2]),
        one('Physics', 'PHYS2001', 'Classical Mechanics', 2),
        one('Physics', 'PHYS3001', 'Quantum Mechanics', 3),
        one('Physics', 'PHYS3002', 'Electromagnetism', 3),
      ],
    },
    {
      name: 'BSc (Chemistry)',
      years: 3,
      courses: [
        ...seq('Chemistry', 'CHEM', 'Chemistry', [1, 2, 3]),
        one('Mathematics', 'MATH1000', 'Mathematics I', 1),
        one('Physics', 'PHYS1000', 'Physics I', 1),
        one('Chemistry', 'CHEM2001', 'Organic Chemistry I', 2),
        one('Chemistry', 'CHEM3001', 'Physical Chemistry I', 3),
      ],
    },
    {
      name: 'BSc (Biological Sciences)',
      years: 3,
      courses: [
        ...seq('Biological Sciences', 'BIOL', 'Biological Sciences', [1, 2, 3]),
        one('Chemistry', 'CHEM1000', 'Chemistry I', 1),
        one('Biological Sciences', 'BIOL2001', 'Genetics I', 2),
        one('Biological Sciences', 'BIOL3001', 'Ecology and Evolution', 3),
      ],
    },
    {
      name: 'BSc (Actuarial Science)',
      years: 3,
      courses: [
        ...seq('Statistics', 'STAT', 'Statistics', [1, 2, 3]),
        ...seq('Mathematics', 'MATH', 'Mathematics', [1, 2]),
        ...seq('Economics', 'ECON', 'Economics', [1, 2]),
        one('Finance', 'FINE1000', 'Financial Mathematics I', 1),
        one('Statistics', 'STAT3001', 'Actuarial Models', 3),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Faculty of Humanities
// ---------------------------------------------------------------------------

const HUMANITIES: Faculty = {
  name: 'Humanities',
  degrees: [
    {
      name: 'BA (Psychology)',
      years: 3,
      courses: [
        ...seq('Psychology', 'PSYC', 'Psychology', [1, 2, 3]),
        ...seq('Sociology', 'SOCL', 'Sociology', [1, 2]),
        one('Psychology', 'PSYC2001', 'Research Methods and Statistics I', 2),
        one('Psychology', 'PSYC3001', 'Psychopathology', 3),
      ],
    },
    {
      name: 'BA (Sociology)',
      years: 3,
      courses: [
        ...seq('Sociology', 'SOCL', 'Sociology', [1, 2, 3]),
        one('Political Studies', 'POLS1000', 'Political Studies I', 1),
        one('Sociology', 'SOCL2001', 'Social Research Methods', 2),
      ],
    },
    {
      name: 'BA (Political Studies)',
      years: 3,
      courses: [
        ...seq('Political Studies', 'POLS', 'Political Studies', [1, 2, 3]),
        one('History', 'HIST1000', 'History I', 1),
        one('Political Studies', 'POLS3001', 'International Relations', 3),
      ],
    },
    {
      name: 'BA (Media Studies)',
      years: 3,
      courses: [
        ...seq('Media Studies', 'MEDS', 'Media Studies', [1, 2, 3]),
        one('Media Studies', 'MEDS2001', 'Digital Media Production', 2),
        one('Sociology', 'SOCL1000', 'Sociology I', 1),
      ],
    },
    {
      name: 'BA (Law)',
      years: 3,
      courses: [
        one('Law', 'LAWS1001', 'Introduction to Law', 1),
        one('Law', 'LAWS2005', 'Public Law I', 2),
        one('Political Studies', 'POLS1000', 'Political Studies I', 1),
        one('Psychology', 'PSYC1000', 'Psychology I', 1),
        one('Law', 'LAWS2003', 'Criminal Law', 2),
        one('Law', 'LAWS3003', 'Labour Law', 3),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Faculty of Education
// ---------------------------------------------------------------------------

const EDUCATION: Faculty = {
  name: 'Education',
  degrees: [
    {
      name: 'BEd (Foundation Phase)',
      years: 4,
      courses: [
        ...seq('Education', 'EDUC', 'Foundation Phase Teaching', [1, 2, 3, 4]),
        one('Education', 'EDUC1001', 'Child Development I', 1),
        one('Education', 'EDUC2001', 'Literacy and Numeracy Methods', 2),
        one('Education', 'EDUC4001', 'Teaching Practice (Final)', 4),
      ],
    },
    {
      name: 'BEd (Senior Phase & FET)',
      years: 4,
      courses: [
        ...seq('Education', 'EDSF', 'Subject Didactics', [1, 2, 3, 4]),
        one('Education', 'EDUC1001', 'Educational Psychology I', 1),
        one('Education', 'EDUC2002', 'Curriculum Studies', 2),
        one('Education', 'EDUC4001', 'Teaching Practice (Final)', 4),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------

export const FACULTIES: Faculty[] = [COMMERCE, ENGINEERING, HEALTH, SCIENCE, HUMANITIES, EDUCATION];

/** Flat lookup helpers */
export function findDegree(facultyName: string, degreeName: string): Degree | undefined {
  return FACULTIES.find((f) => f.name === facultyName)?.degrees.find((d) => d.name === degreeName);
}

/** Display label for a varsity course selection, e.g. "Financial Accounting II (ACCN2000) · Year 2". */
export function courseLabel(c: Course): string {
  return `${c.name} (${c.code}) · Year ${c.year}`;
}
