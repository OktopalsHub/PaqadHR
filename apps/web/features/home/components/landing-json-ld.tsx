import type { ReactNode } from "react";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Paqad",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "People operations software for recruitment, payroll, leave management, and team recognition.",
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
