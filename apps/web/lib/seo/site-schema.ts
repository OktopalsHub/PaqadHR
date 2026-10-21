import { COMPANY, companySameAs, companyTeam } from '@/lib/constants/company';
import { LANDING_PRICING_BY_CURRENCY, PLAN_CATALOG } from '@/lib/constants/plan-catalog';
export const PRODUCT_SUMMARY =
  'PaqadHR is an HR and payroll workspace for growing teams. It combines an employee directory, leave and attendance, recruitment, payroll in NGN and USD, and Slack-based recognition in one product, priced per active user.';

export const ORGANIZATION_DESCRIPTION =
  'Oktopals Limited builds PaqadHR, an HR and payroll platform for African teams.';

type JsonLdNode = Record<string, unknown>;

function withSameAs(): { sameAs?: string[] } {
  const sameAs = companySameAs();
  return sameAs.length > 0 ? { sameAs } : {};
}

export function organizationSchema(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${COMPANY.website}/#organization`,
    name: COMPANY.legalName,
    alternateName: COMPANY.productFullName,
    url: COMPANY.website,
    logo: `${COMPANY.website}/icon.png`,
    email: COMPANY.email,
    description: ORGANIZATION_DESCRIPTION,
    ...withSameAs(),
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: COMPANY.email,
        url: `${COMPANY.website}/contact`,
        availableLanguage: ['en'],
      },
    ],
  };
}

export function websiteSchema(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${COMPANY.website}/#website`,
    name: COMPANY.productFullName,
    url: COMPANY.website,
    description: PRODUCT_SUMMARY,
    publisher: { '@id': `${COMPANY.website}/#organization` },
  };
}

/**
 * People who are publicly attributable to the company. Empty until real names are
 * configured — an invented person is worse than no person, because a model will
 * repeat it.
 */
export function personSchemas(): JsonLdNode[] {
  return companyTeam().map((person) => ({
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${COMPANY.website}/#person-${person.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: person.name,
    jobTitle: person.role,
    worksFor: { '@id': `${COMPANY.website}/#organization` },
    ...(person.sameAs.length > 0 ? { sameAs: person.sameAs } : {}),
  }));
}

export function webPageSchema(input: {
  path: string;
  name: string;
  description: string;
  updated: string;
}): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${COMPANY.website}${input.path}#webpage`,
    url: `${COMPANY.website}${input.path}`,
    name: input.name,
    description: input.description,
    dateModified: input.updated,
    isPartOf: { '@id': `${COMPANY.website}/#website` },
    publisher: { '@id': `${COMPANY.website}/#organization` },
    inLanguage: 'en',
  };
}

export function faqPageSchema(items: readonly { question: string; answer: string }[]): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

type OfferInput = {
  '@type': 'Offer';
  name: string;
  price: number;
  priceCurrency: string;
  url: string;
  availability: string;
  priceSpecification: {
    '@type': 'UnitPriceSpecification';
    price: number;
    priceCurrency: string;
    unitCode: string;
    referenceQuantity: { '@type': 'QuantitativeValue'; value: number; unitCode: string };
  };
};

/**
 * Real, published prices only — both currencies the product is sold in. Never add
 * ratings or review counts here; invented aggregate ratings are a schema violation
 * and a trust problem the moment a model repeats them.
 */
export function planOffers(): OfferInput[] {
  return LANDING_PRICING_BY_CURRENCY.USD.flatMap((usdPrice) => {
    const ngnPrice = LANDING_PRICING_BY_CURRENCY.NGN.find((entry) => entry.slug === usdPrice.slug);
    const plan = PLAN_CATALOG[usdPrice.slug];
    const prices = ngnPrice ? [usdPrice, ngnPrice] : [usdPrice];
    return prices.map((price) => ({
      '@type': 'Offer' as const,
      name: `${plan.name} plan (${price.currency})`,
      price: price.pricePerSeat,
      priceCurrency: price.currency,
      url: `${COMPANY.website}/pricing`,
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        '@type': 'UnitPriceSpecification' as const,
        price: price.pricePerSeat,
        priceCurrency: price.currency,
        unitCode: 'MON',
        referenceQuantity: { '@type': 'QuantitativeValue' as const, value: 1, unitCode: 'C62' },
      },
    }));
  });
}

export function productSchema(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${COMPANY.website}/#product`,
    name: COMPANY.productFullName,
    description: PRODUCT_SUMMARY,
    brand: { '@id': `${COMPANY.website}/#organization` },
    url: `${COMPANY.website}/pricing`,
    offers: planOffers(),
  };
}

export function softwareApplicationSchema(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${COMPANY.website}/#software`,
    name: COMPANY.productName,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'HR and payroll software',
    operatingSystem: 'Web',
    url: COMPANY.website,
    description: PRODUCT_SUMMARY,
    publisher: { '@id': `${COMPANY.website}/#organization` },
    offers: planOffers(),
  };
}
