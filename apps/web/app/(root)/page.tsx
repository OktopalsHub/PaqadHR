import type { Metadata } from 'next';
import { LandingJsonLd } from '@/features/home/components/landing-json-ld';
import { LandingPage } from '@/features/home/components/landing-page';

export const metadata: Metadata = {
  title: 'Paqad — People operations for modern teams',
  description:
    'Simplify hiring, empower teams, and run people operations with one calm workspace — recruitment, payroll, leave, and recognition.',
  keywords: [
    'HR software',
    'people operations',
    'recruitment software',
    'payroll management',
    'leave management',
    'employee management',
    'HR platform Nigeria',
    'team shoutouts',
  ],
  openGraph: {
    title: 'Paqad — People operations for modern teams',
    description:
      'Simplify hiring, empower teams, and run people operations with one calm workspace — recruitment, payroll, leave, and recognition.',
    type: 'website',
    siteName: 'Paqad',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Paqad — People operations for modern teams',
    description:
      'Simplify hiring, empower teams, and run people operations with one calm workspace — recruitment, payroll, leave, and recognition.',
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
