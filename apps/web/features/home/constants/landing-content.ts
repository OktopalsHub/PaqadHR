import { Briefcase, Calendar, Heart, LineChart, Users, Wallet } from 'lucide-react';

export const services = [
  {
    icon: Users,
    title: 'People directory',
    description: 'Org charts, profiles, and employment records kept current in one place.',
  },
  {
    icon: Briefcase,
    title: 'Recruitment',
    description: 'Publish roles, track candidates, and move hires through your pipeline.',
  },
  {
    icon: Wallet,
    title: 'Payroll exports',
    description: 'Run calculations, export bank files, and mark disbursements offline.',
  },
  {
    icon: Calendar,
    title: 'Leave management',
    description: 'Requests, balances, and team calendars without spreadsheet chaos.',
  },
  {
    icon: Heart,
    title: 'Shoutouts',
    description: 'Peer recognition with points and a feed your team actually uses.',
  },
  {
    icon: LineChart,
    title: 'Workforce insights',
    description: 'Headcount, attendance trends, and lightweight analytics at a glance.',
  },
];

export const showcases = [
  {
    eyebrow: 'Recruitment',
    title: 'Hire with clarity from first post to offer',
    description:
      'Open roles, track applicants, and schedule interviews without leaving Paqad. Your pipeline stays visible to everyone who needs it.',
    highlights: ['Job postings', 'Candidate pipeline', 'Interview tracking'],
    mockVariant: 'recruitment' as const,
  },
  {
    eyebrow: 'Payroll',
    title: 'Payroll runs that fit how you actually pay',
    description:
      'Calculate salaries, review totals, export bank-ready files, and mark runs paid when money leaves your account.',
    highlights: ['Run calculator', 'Bank file export', 'Approval workflow'],
    mockVariant: 'payroll' as const,
  },
  {
    eyebrow: 'Culture',
    title: 'Recognition built into daily work',
    description:
      'Shoutouts, leave visibility, and team calendars keep people connected without another Slack bot.',
    highlights: ['Shoutout feed', 'Leave calendar', 'Team shoutouts'],
    mockVariant: 'culture' as const,
  },
];
