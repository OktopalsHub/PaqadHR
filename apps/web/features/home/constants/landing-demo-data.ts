export type DemoNavId = 'dashboard' | 'recruitment' | 'payroll' | 'shoutouts' | 'leaves';

export type DemoTab = DemoNavId;

export const demoNavOrder: DemoNavId[] = [
  'dashboard',
  'recruitment',
  'payroll',
  'shoutouts',
  'leaves',
];

export const demoDashboardStats = [
  { label: 'Team members', value: 42, hint: '3 joined this month' },
  { label: 'Open roles', value: 4, hint: '2 in final interview' },
  { label: 'Pending leave', value: 3, hint: 'Awaiting approval' },
  { label: 'Payroll due', value: '$24.5K', hint: 'Net — Mar run' },
];

export type DemoLeaveRequest = {
  id: string;
  name: string;
  type: string;
  dates: string;
  status: 'approved' | 'pending' | 'rejected';
};

export const demoLeaveRequests: DemoLeaveRequest[] = [
  {
    id: 'l1',
    name: 'Sarah Chen',
    type: 'Annual leave',
    dates: '24–28 Mar 2026',
    status: 'pending',
  },
  {
    id: 'l2',
    name: 'James Miller',
    type: 'Sick leave',
    dates: '20 Mar 2026',
    status: 'approved',
  },
  {
    id: 'l3',
    name: 'Priya Patel',
    type: 'Annual leave',
    dates: '7–11 Apr 2026',
    status: 'pending',
  },
];

export const demoWorkspace = {
  name: 'Acme HR',
  slug: 'acme-hr',
};

export type DemoKanbanCard = {
  id: string;
  name: string;
  role: string;
};

export type DemoKanbanColumn = {
  id: string;
  title: string;
  cards: DemoKanbanCard[];
};

export const demoRecruitmentStats = [
  { label: 'Open roles', value: 4, hint: '2 new this week' },
  { label: 'Applicants', value: 28, hint: 'Across all roles' },
  { label: 'In interview', value: 6, hint: 'Scheduled this week' },
  { label: 'Offers out', value: 2, hint: 'Pending acceptance' },
];

export const demoKanbanColumns: DemoKanbanColumn[] = [
  {
    id: 'applied',
    title: 'Applied',
    cards: [
      { id: 'c1', name: 'Maya Rodriguez', role: 'Product Designer' },
      { id: 'c2', name: 'Alex Kim', role: 'Backend Engineer' },
    ],
  },
  {
    id: 'screen',
    title: 'Screen',
    cards: [{ id: 'c3', name: 'Elena Rossi', role: 'People Ops' }],
  },
  {
    id: 'interview',
    title: 'Interview',
    cards: [
      { id: 'c4', name: 'David Park', role: 'Sales Lead' },
      { id: 'c5', name: 'Sofia Martinez', role: 'Accountant' },
    ],
  },
  {
    id: 'offer',
    title: 'Offer',
    cards: [{ id: 'c6', name: "Liam O'Brien", role: 'Frontend Engineer' }],
  },
];

export type DemoPayrollEmployee = {
  id: string;
  name: string;
  department: string;
  amount: number;
  status: 'paid' | 'processing' | 'approved';
};

export const demoPayrollRun = {
  title: 'March 2026 Payroll',
  period: '1 Mar – 31 Mar 2026',
  currency: 'USD',
  totalNet: 24_500,
  employeeCount: 3,
  status: 'Approved',
};

export const demoPayrollEmployees: DemoPayrollEmployee[] = [
  {
    id: 'e1',
    name: 'Sarah Chen',
    department: 'Engineering',
    amount: 8_500,
    status: 'paid',
  },
  {
    id: 'e2',
    name: 'James Miller',
    department: 'Sales',
    amount: 6_200,
    status: 'processing',
  },
  {
    id: 'e3',
    name: 'Priya Patel',
    department: 'Operations',
    amount: 9_800,
    status: 'approved',
  },
];

export type DemoShoutout = {
  id: string;
  sender: string;
  senderInitials: string;
  recipients: string;
  message: string;
  points: number;
  category?: string;
  timeAgo: string;
};

export const demoShoutouts: DemoShoutout[] = [
  {
    id: 's1',
    sender: 'Sarah Chen',
    senderInitials: 'SC',
    recipients: 'James Miller',
    message: 'Crushed the Q1 enterprise demo — clients loved the payroll walkthrough.',
    points: 25,
    category: 'Teamwork',
    timeAgo: '2 hours ago',
  },
  {
    id: 's2',
    sender: 'HR Team',
    senderInitials: 'HR',
    recipients: 'Priya Patel',
    message: 'Zero payroll exceptions this run. Thank you for the spotless reconciliation.',
    points: 50,
    category: 'Excellence',
    timeAgo: 'Yesterday',
  },
];

export const demoSidebarItems = [
  { id: 'dashboard' as const, label: 'Dashboard' },
  { id: 'recruitment' as const, label: 'Recruitment' },
  { id: 'payroll' as const, label: 'Payroll' },
  { id: 'shoutouts' as const, label: 'Shoutouts' },
  { id: 'leaves' as const, label: 'Leave' },
];
