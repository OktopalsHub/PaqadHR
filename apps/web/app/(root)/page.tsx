import type { Metadata } from 'next';
import { LandingJsonLd } from '@/features/home/components/landing-json-ld';
import { LandingPage } from '@/features/home/components/landing-page';

export const metadata: Metadata = {
  title: 'Paqad — HR and payroll in one workspace',
  description:
    'Hire, pay, and recognize your people in one workspace. Recruitment kanban, payroll, leave management, and Slack shoutouts for growing teams.',
  keywords: [
    'HR software',
    'payroll software',
    'people operations',
    'recruitment software',
    'leave management',
    'employee recognition',
    'HR platform',
    'workforce management',
  ],
  openGraph: {
    title: 'Paqad — HR and payroll in one workspace',
    description:
      'Hire, pay, and recognize your people in one workspace. Recruitment, payroll, leave, and shoutouts.',
    type: 'website',
    siteName: 'Paqad',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Paqad — HR and payroll in one workspace',
    description:
      'Hire, pay, and recognize your people in one workspace. Recruitment, payroll, leave, and shoutouts.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Home() {
  return (
    <LandingJsonLd>
      <LandingPage />
    </LandingJsonLd>
  );
}
