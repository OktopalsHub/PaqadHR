'use client';

import { ForceLightTheme } from '@/providers/force-light-theme';
import { LandingCta } from './sections/landing-cta';
import { LandingFeaturesSection } from './sections/landing-features-section';
import { LandingFooter } from './sections/landing-footer';
import { LandingHero } from './sections/landing-hero';
import { LandingLogoStrip } from './sections/landing-logo-strip';
import { LandingNav } from './sections/landing-nav';
import { LandingShowcase } from './sections/landing-showcase';
import { LandingTestimonials } from './sections/landing-testimonials-row';

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
