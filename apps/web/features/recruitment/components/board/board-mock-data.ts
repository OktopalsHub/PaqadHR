import type { Candidate, CandidateStatus } from '@/lib/schemas/recruitment';
import type { BoardColumnId } from './board-columns';

export type MockCandidate = {
  id: string;
  columnId: BoardColumnId;
  firstName: string;
  lastName: string;
  email: string;
  summary: string;
  fileCount: number;
  matchScore?: number;
};

export type MockJob = {
  id: string;
  title: string;
  description: string;
};

export const DEFAULT_LANDING_JOB_ID = 'product-designer';

export const MOCK_CANDIDATES: MockCandidate[] = [
  {
    id: '1',
    columnId: 'applied',
    firstName: 'Robert',
    lastName: 'Fox',
    email: 'robert.fox@mail.com',
    summary: '5 years in product design with strong UX research background.',
    fileCount: 13,
    matchScore: 84,
  },
  {
    id: '2',
    columnId: 'applied',
    firstName: 'Cody',
    lastName: 'Fisher',
    email: 'cody.fisher@mail.com',
    summary: 'Visual designer transitioning into product design roles.',
    fileCount: 8,
    matchScore: 76,
  },
  {
    id: '3',
    columnId: 'review',
    firstName: 'Ralph',
    lastName: 'Edwards',
    email: 'ralph.edwards@mail.com',
    summary: 'Led design systems at a fast-growing SaaS startup.',
    fileCount: 11,
    matchScore: 88,
  },
  {
    id: '4',
    columnId: 'review',
    firstName: 'Devon',
    lastName: 'Lane',
    email: 'devon.lane@mail.com',
    summary: 'Portfolio focused on mobile-first consumer products.',
    fileCount: 6,
    matchScore: 72,
  },
  {
    id: '5',
    columnId: 'interview',
    firstName: 'Kathryn',
    lastName: 'Murphy',
    email: 'kathryn.murphy@mail.com',
    summary: 'Senior designer with enterprise dashboard experience.',
    fileCount: 15,
    matchScore: 91,
  },
  {
    id: '6',
    columnId: 'interview',
    firstName: 'Kristin',
    lastName: 'Watson',
    email: 'kristin.watson@mail.com',
    summary: 'Strong prototyping skills and cross-functional collaboration.',
    fileCount: 9,
    matchScore: 85,
  },
  {
    id: '7',
    columnId: 'hiring',
    firstName: 'Floyd',
    lastName: 'Miles',
    email: 'floyd.miles@mail.com',
    summary: 'Previously shipped two 0→1 products as lead designer.',
    fileCount: 12,
    matchScore: 93,
  },
  {
    id: '8',
    columnId: 'hiring',
    firstName: 'Bessie',
    lastName: 'Cooper',
    email: 'bessie.cooper@mail.com',
    summary: 'Design ops experience with Figma and design tokens.',
    fileCount: 10,
    matchScore: 89,
  },
];

export const MOCK_GRAPHIC_CANDIDATES: MockCandidate[] = [
  {
    id: 'g1',
    columnId: 'applied',
    firstName: 'Annette',
    lastName: 'Black',
    email: 'annette.black@mail.com',
    summary: 'Brand identity specialist with agency and in-house experience.',
    fileCount: 10,
    matchScore: 82,
  },
  {
    id: 'g2',
    columnId: 'applied',
    firstName: 'Jerome',
    lastName: 'Bell',
    email: 'jerome.bell@mail.com',
    summary: 'Motion graphics and social campaign designer.',
    fileCount: 7,
    matchScore: 74,
  },
  {
    id: 'g3',
    columnId: 'review',
    firstName: 'Leslie',
    lastName: 'Alexander',
    email: 'leslie.alexander@mail.com',
    summary: 'Print and packaging design for consumer goods brands.',
    fileCount: 14,
    matchScore: 86,
  },
  {
    id: 'g4',
    columnId: 'review',
    firstName: 'Guy',
    lastName: 'Hawkins',
    email: 'guy.hawkins@mail.com',
    summary: 'Illustration-led visual design for editorial projects.',
    fileCount: 5,
    matchScore: 70,
  },
  {
    id: 'g5',
    columnId: 'interview',
    firstName: 'Eleanor',
    lastName: 'Pena',
    email: 'eleanor.pena@mail.com',
    summary: 'Typography-focused designer with award-winning campaign work.',
    fileCount: 12,
    matchScore: 90,
  },
  {
    id: 'g6',
    columnId: 'interview',
    firstName: 'Marvin',
    lastName: 'McKinney',
    email: 'marvin.mckinney@mail.com',
    summary: 'Experienced in Adobe Creative Suite and brand guidelines.',
    fileCount: 9,
    matchScore: 83,
  },
  {
    id: 'g7',
    columnId: 'hiring',
    firstName: 'Savannah',
    lastName: 'Nguyen',
    email: 'savannah.nguyen@mail.com',
    summary: 'Led rebrand for a Series B startup from concept to launch.',
    fileCount: 11,
    matchScore: 92,
  },
];

const MOCK_CANDIDATES_BY_JOB: Record<string, MockCandidate[]> = {
  'product-designer': MOCK_CANDIDATES,
  'graphic-designer': MOCK_GRAPHIC_CANDIDATES,
};

export const MOCK_JOBS: MockJob[] = [
  {
    id: 'product-designer',
    title: 'Product Designer',
    description: 'Professional responsible for creating experience product.',
  },
  {
    id: 'graphic-designer',
    title: 'Graphic Designer',
    description: 'Creative role focused on brand visuals, campaigns, and marketing assets.',
  },
];

/** @deprecated Use MOCK_JOBS.find(j => j.id === DEFAULT_LANDING_JOB_ID) */
export const MOCK_JOB = {
  title: MOCK_JOBS[0].title,
  description: MOCK_JOBS[0].description,
  qualified: 21,
  disqualified: 4,
};

const DEMO_DISQUALIFIED_BY_JOB: Record<
  string,
  Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    summary: string;
    status: CandidateStatus;
  }>
> = {
  'product-designer': [
    {
      id: 'demo-rejected-1',
      firstName: 'Jacob',
      lastName: 'Jones',
      email: 'jacob.jones@mail.com',
      summary: 'Insufficient portfolio depth for senior requirements.',
      status: 'REJECTED',
    },
    {
      id: 'demo-withdrawn-1',
      firstName: 'Esther',
      lastName: 'Howard',
      email: 'esther.howard@mail.com',
      summary: 'Withdrew after accepting another offer.',
      status: 'WITHDRAWN',
    },
  ],
  'graphic-designer': [
    {
      id: 'demo-rejected-g1',
      firstName: 'Theresa',
      lastName: 'Webb',
      email: 'theresa.webb@mail.com',
      summary: 'Portfolio lacked brand campaign examples.',
      status: 'REJECTED',
    },
    {
      id: 'demo-withdrawn-g1',
      firstName: 'Ronald',
      lastName: 'Richards',
      email: 'ronald.richards@mail.com',
      summary: 'Accepted a freelance contract elsewhere.',
      status: 'WITHDRAWN',
    },
  ],
};

function statusForColumn(columnId: BoardColumnId, index: number): CandidateStatus {
  switch (columnId) {
    case 'applied':
      return 'APPLIED';
    case 'review':
      return index === 0 ? 'SCREENING' : 'UNDER_REVIEW';
    case 'interview':
      return 'INTERVIEW';
    case 'hiring':
      return index === 0 ? 'OFFER' : 'HIRED';
    default:
      return 'APPLIED';
  }
}

function mockCandidatesForJobId(jobId: string): MockCandidate[] {
  return MOCK_CANDIDATES_BY_JOB[jobId] ?? MOCK_CANDIDATES;
}

export function isDemoCandidateId(id: string) {
  return id.startsWith('demo-');
}

export function getMockJob(jobId: string): MockJob {
  return MOCK_JOBS.find((job) => job.id === jobId) ?? MOCK_JOBS[0];
}

export function demoCandidatesForJob(jobId: string): Candidate[] {
  const now = new Date().toISOString();
  const mocks = mockCandidatesForJobId(jobId);
  const jobKey = MOCK_CANDIDATES_BY_JOB[jobId] ? jobId : DEFAULT_LANDING_JOB_ID;

  const qualified = mocks.map((mock) => {
    const columnIndex = mocks.filter((c) => c.columnId === mock.columnId).indexOf(mock);

    return {
      id: `demo-${mock.id}`,
      jobOpeningId: jobId,
      firstName: mock.firstName,
      lastName: mock.lastName,
      email: mock.email,
      status: statusForColumn(mock.columnId, columnIndex),
      skills: mock.summary,
      resume: { filename: mock.fileCount > 0 ? 'resume.pdf' : undefined },
      appliedAt: now,
      createdAt: now,
      updatedAt: now,
    } satisfies Candidate;
  });

  const disqualified = (DEMO_DISQUALIFIED_BY_JOB[jobKey] ?? []).map(
    (mock) =>
      ({
        id: mock.id,
        jobOpeningId: jobId,
        firstName: mock.firstName,
        lastName: mock.lastName,
        email: mock.email,
        status: mock.status,
        skills: mock.summary,
        resume: { filename: 'resume.pdf' },
        appliedAt: now,
        createdAt: now,
        updatedAt: now,
      }) satisfies Candidate,
  );

  return [...qualified, ...disqualified];
}
