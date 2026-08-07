import type { ReactNode } from 'react';
import { getCspNonce } from '@/lib/security/csp-nonce';

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

export async function LandingJsonLd({ children }: { children: ReactNode }) {
  const nonce = await getCspNonce();

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        // Browsers intentionally hide nonce attributes from client-side DOM reads.
        // The server-rendered nonce remains required by the CSP.
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires inline script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {children}
    </>
  );
}
