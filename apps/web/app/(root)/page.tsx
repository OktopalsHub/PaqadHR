import type { Metadata } from 'next';
import { LandingJsonLd } from '@/features/home/components/landing-json-ld';
import { LandingPage } from '@/features/home/components/landing-page';

export const metadata: Metadata = {
  // `absolute` bypasses the root layout's `%s · PaqadHR` template, which turned
  // a page title of "PaqadHR" into "PaqadHR · PaqadHR" and spent the whole title
  // budget on the brand instead of the category.
  title: {
    absolute: 'PaqadHR — HR, payroll & recognition in one workspace',
  },
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
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'PaqadHR — HR, payroll & recognition in one workspace',
    description:
      'Hire, pay, and recognize your people in one workspace. Recruitment, payroll, leave, and shoutouts.',
    type: 'website',
    siteName: 'PaqadHR',
    url: 'https://paqadhr.com/',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'PaqadHR: hire, pay, and support your team in one workspace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PaqadHR — HR, payroll & recognition in one workspace',
    description:
      'Hire, pay, and recognize your people in one workspace. Recruitment, payroll, leave, and shoutouts.',
    images: ['/opengraph-image'],
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
