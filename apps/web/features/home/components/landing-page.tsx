'use client';

import dynamic from 'next/dynamic';
import { ForceLightTheme } from '@/providers/force-light-theme';
import { LandingCta } from './sections/landing-cta';
import { LandingHero } from './sections/landing-hero';
import { LandingLogoStrip } from './sections/landing-logo-strip';
import { LandingNav } from './sections/landing-nav';

function SectionFallback() {
  return <div className="w-full h-64 animate-pulse bg-muted/30" />;
}

const LandingFeaturesSection = dynamic(
  () => import('./sections/landing-features-section').then((m) => m.LandingFeaturesSection),
  { ssr: false, loading: SectionFallback },
);
const LandingShowcase = dynamic(
  () => import('./sections/landing-showcase').then((m) => m.LandingShowcase),
  { ssr: false, loading: SectionFallback },
);
const LandingTestimonials = dynamic(
  () => import('./sections/landing-testimonials-row').then((m) => m.LandingTestimonials),
  { ssr: false, loading: SectionFallback },
);
const LandingFooter = dynamic(
  () => import('./sections/landing-footer').then((m) => m.LandingFooter),
  { ssr: false, loading: SectionFallback },
);

export const LandingPage = () => {
  return (
    <ForceLightTheme>
      <LandingNav />
      <main>
        <LandingHero />
        <LandingLogoStrip />
        <LandingShowcase />
        <LandingFeaturesSection />
        <LandingTestimonials />
        <LandingCta />
      </main>
      <LandingFooter />
    </ForceLightTheme>
  );
};
