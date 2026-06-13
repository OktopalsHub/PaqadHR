import type { BoardColumnId } from "./board-columns";
import type { Candidate, CandidateStatus } from "@/lib/schemas/recruitment";

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

export const MOCK_JOB = {
  title: "Product Designer",
  description:
    "Professional responsible for creating experience product.",
  qualified: 21,
  disqualified: 4,
};

export const MOCK_CANDIDATES: MockCandidate[] = [
  {
    id: "1",
    columnId: "applied",
    firstName: "Robert",
    lastName: "Fox",
    email: "robert.fox@mail.com",
    summary: "5 years in product design with strong UX research background.",
    fileCount: 13,
    matchScore: 84,
  },
  {
    id: "2",
    columnId: "applied",
    firstName: "Cody",
    lastName: "Fisher",
    email: "cody.fisher@mail.com",
    summary: "Visual designer transitioning into product design roles.",
    fileCount: 8,
    matchScore: 76,
  },
  {
    id: "3",
    columnId: "review",
    firstName: "Ralph",
    lastName: "Edwards",
    email: "ralph.edwards@mail.com",
    summary: "Led design systems at a fast-growing SaaS startup.",
    fileCount: 11,
    matchScore: 88,
  },
  {
    id: "4",
    columnId: "review",
    firstName: "Devon",
    lastName: "Lane",
    email: "devon.lane@mail.com",
    summary: "Portfolio focused on mobile-first consumer products.",
    fileCount: 6,
    matchScore: 72,
  },
  {
    id: "5",
    columnId: "interview",
    firstName: "Kathryn",
    lastName: "Murphy",
    email: "kathryn.murphy@mail.com",
    summary: "Senior designer with enterprise dashboard experience.",
    fileCount: 15,
    matchScore: 91,
  },
  {
    id: "6",
    columnId: "interview",
    firstName: "Kristin",
    lastName: "Watson",
    email: "kristin.watson@mail.com",
    summary: "Strong prototyping skills and cross-functional collaboration.",
    fileCount: 9,
    matchScore: 85,
  },
  {
    id: "7",
    columnId: "hiring",
    firstName: "Floyd",
    lastName: "Miles",
    email: "floyd.miles@mail.com",
    summary: "Previously shipped two 0→1 products as lead designer.",
    fileCount: 12,
    matchScore: 93,
  },
  {
    id: "8",
    columnId: "hiring",
    firstName: "Bessie",
    lastName: "Cooper",
    email: "bessie.cooper@mail.com",
    summary: "Design ops experience with Figma and design tokens.",
    fileCount: 10,
    matchScore: 89,
  },
];

const DEMO_DISQUALIFIED: Array<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  summary: string;
  status: CandidateStatus;
}> = [
  {
    id: "demo-rejected-1",
    firstName: "Jacob",
    lastName: "Jones",
    email: "jacob.jones@mail.com",
    summary: "Insufficient portfolio depth for senior requirements.",
    status: "REJECTED",
  },
  {
    id: "demo-withdrawn-1",
    firstName: "Esther",
    lastName: "Howard",
    email: "esther.howard@mail.com",
    summary: "Withdrew after accepting another offer.",
    status: "WITHDRAWN",
  },
];

function statusForColumn(columnId: BoardColumnId, index: number): CandidateStatus {
  switch (columnId) {
    case "applied":
      return "APPLIED";
    case "review":
      return index === 0 ? "SCREENING" : "UNDER_REVIEW";
    case "interview":
      return "INTERVIEW";
    case "hiring":
      return index === 0 ? "OFFER" : "HIRED";
    default:
      return "APPLIED";
  }
}

export function isDemoCandidateId(id: string) {
  return id.startsWith("demo-");
}

export function demoCandidatesForJob(jobId: string): Candidate[] {
  const now = new Date().toISOString();

  const qualified = MOCK_CANDIDATES.map((mock, index) => {
    const columnIndex = MOCK_CANDIDATES.filter(
      (c) => c.columnId === mock.columnId,
    ).indexOf(mock);

    return {
      id: `demo-${mock.id}`,
      jobOpeningId: jobId,
      firstName: mock.firstName,
      lastName: mock.lastName,
      email: mock.email,
      status: statusForColumn(mock.columnId, columnIndex),
      skills: mock.summary,
      resume: { filename: mock.fileCount > 0 ? "resume.pdf" : undefined },
      appliedAt: now,
      createdAt: now,
      updatedAt: now,
    } satisfies Candidate;
  });

  const disqualified = DEMO_DISQUALIFIED.map((mock) => ({
    id: mock.id,
    jobOpeningId: jobId,
    firstName: mock.firstName,
    lastName: mock.lastName,
    email: mock.email,
    status: mock.status,
    skills: mock.summary,
    resume: { filename: "resume.pdf" },
    appliedAt: now,
    createdAt: now,
    updatedAt: now,
  } satisfies Candidate));

  return [...qualified, ...disqualified];
}

export const MOCK_SIDEBAR_ITEMS = [
  { label: "Dashboard", active: false },
  { label: "Analytics", active: false },
  { label: "Open Jobs", active: false },
  {
    label: "Recruitment Board",
    active: true,
    children: ["Product Designer", "Graphic Designer"],
  },
  { label: "All Candidates", active: false },
  { label: "Help Center", active: false },
  { label: "Settings", active: false },
];
