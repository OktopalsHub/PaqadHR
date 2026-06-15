import type { ReactNode } from "react";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Paqad",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Simplify hiring, empower teams, and run people operations with one calm workspace — recruitment, payroll, leave, and recognition.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "14-day free trial",
  },
};

export function LandingJsonLd({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {children}
    </>
  );
}
