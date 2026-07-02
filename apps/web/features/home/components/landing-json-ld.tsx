import type { ReactNode } from 'react';

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Paqad',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'HR and payroll in one workspace — recruitment kanban, payroll, leave management, and Slack shoutouts for growing teams.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: '14-day free trial',
  },
};

export function LandingJsonLd({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires inline script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {children}
    </>
  );
}
