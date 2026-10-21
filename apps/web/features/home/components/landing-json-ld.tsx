import type { ReactNode } from 'react';
import { JsonLd } from '@/components/json-ld';
import {
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from '@/lib/seo/site-schema';

export async function LandingJsonLd({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd data={[organizationSchema(), websiteSchema(), softwareApplicationSchema()]} />
      {children}
    </>
  );
}
