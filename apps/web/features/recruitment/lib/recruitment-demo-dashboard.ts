import type { CalendarEvent } from "@/lib/schemas/calendar";
import type { Candidate, JobOpening } from "@/lib/schemas/recruitment";
import { demoCandidatesForJob } from "../components/board/board-mock-data";
import type {
  ApplicationsChartPoint,
  DepartmentChartPoint,
  RecruitmentKpis,
  SourceChartPoint,
} from "./recruitment-dashboard-metrics";

export type ScheduleEvent = {
  id: string;
  time: string;
  title: string;
  type: CalendarEvent["type"];
};

export type ActivityItem = {
  id: string;
  actor: string;
  action: string;
  occurredAt: string;
};

const DEMO_JOB_IDS = ["demo-job-1", "demo-job-2", "demo-job-3", "demo-job-4"];

export const DEMO_JOBS: JobOpening[] = [
  {
    id: "demo-job-1",
    title: "Software Developer",
    departmentName: "Engineering",
    employmentType: "FULL_TIME",
    status: "ACTIVE",
    numberOfOpenings: 2,
    location: { type: "REMOTE" },
  },
  {
    id: "demo-job-2",
    title: "Graphic Designer",
    departmentName: "Marketing",
    employmentType: "FULL_TIME",
    status: "ACTIVE",
    numberOfOpenings: 1,
    location: { type: "HYBRID", city: "Lagos" },
  },
  {
    id: "demo-job-3",
    title: "Product Designer",
    departmentName: "Product",
    employmentType: "FULL_TIME",
    status: "ACTIVE",
    numberOfOpenings: 1,
    location: { type: "REMOTE" },
  },
  {
    id: "demo-job-4",
    title: "HR Specialist",
    departmentName: "Human Resources",
    employmentType: "PART_TIME",
    status: "ACTIVE",
    numberOfOpenings: 1,
    location: { type: "ONSITE", city: "Abuja" },
  },
];

export const DEMO_KPIS: RecruitmentKpis = {
  applications: 1534,
  shortlisted: 869,
  hired: 236,
  rejected: 429,
  trends: {
    applications: { value: "+12.67%", positive: true },
    shortlisted: { value: "-1.98%", positive: false },
    hired: { value: "+8.35%", positive: true },
    rejected: { value: "-2.81%", positive: false },
  },
};

export const DEMO_APPLICATIONS_CHART: ApplicationsChartPoint[] = [
  { label: "May 13", applied: 42, shortlisted: 18 },
  { label: "May 14", applied: 38, shortlisted: 22 },
  { label: "May 15", applied: 55, shortlisted: 28 },
  { label: "May 16", applied: 48, shortlisted: 24 },
  { label: "May 17", applied: 61, shortlisted: 31 },
  { label: "May 18", applied: 52, shortlisted: 27 },
  { label: "May 19", applied: 47, shortlisted: 25 },
];

export const DEMO_DEPARTMENT_CHART: DepartmentChartPoint[] = [
  { name: "Engineering", value: 120 },
  { name: "Marketing", value: 110 },
  { name: "Sales", value: 95 },
  { name: "Customer Support", value: 85 },
  { name: "Finance", value: 65 },
  { name: "Human Resources", value: 50 },
];

export const DEMO_SOURCE_CHART: SourceChartPoint[] = [
  { name: "Job boards", value: 350, source: "PUBLIC_WEBSITE" },
  { name: "Employee referrals", value: 200, source: "INTERNAL" },
  { name: "LinkedIn", value: 300, source: "LINKEDIN" },
  { name: "Indeed", value: 150, source: "INDEED" },
];

export const DEMO_SCHEDULE: ScheduleEvent[] = [
  {
    id: "1",
    time: "09:00 – 10:00",
    title: "Marketing Strategy Presentation",
    type: "meeting",
  },
  {
    id: "2",
    time: "11:30 – 12:30",
    title: "Candidate interview — Product Designer",
    type: "review",
  },
  {
    id: "3",
    time: "14:00 – 15:00",
    title: "HR Policy Update Session",
    type: "meeting",
  },
  {
    id: "4",
    time: "16:00 – 16:45",
    title: "Offer review — Software Developer",
    type: "review",
  },
];

export const DEMO_ACTIVITY: ActivityItem[] = [
  {
    id: "1",
    actor: "Darren Wright",
    action: "viewed 15 candidate profiles",
    occurredAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: "2",
    actor: "Caren Smith",
    action: "scheduled 3 interviews for Product Designer",
    occurredAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "3",
    actor: "Andrew Sebastian",
    action: "moved Kathryn Murphy to Interview stage",
    occurredAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: "4",
    actor: "Zara Okonkwo",
    action: "published Software Developer role",
    occurredAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
];

export function demoCandidatesForDashboard(): Candidate[] {
  return DEMO_JOB_IDS.flatMap((jobId) => demoCandidatesForJob(jobId));
}

export function demoApplicantCounts(): Record<string, number> {
  return {
    "demo-job-1": 24,
    "demo-job-2": 18,
    "demo-job-3": 31,
    "demo-job-4": 12,
  };
}
