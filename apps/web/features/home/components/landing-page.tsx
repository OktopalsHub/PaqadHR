import { ForceLightTheme } from '@/providers/force-light-theme';
import { LandingNav } from './sections/landing-nav';
import { LandingHero } from './sections/landing-hero';
import { LandingFeaturesSection } from './sections/landing-features-section';
import { LandingShowcase } from './sections/landing-showcase';
import { LandingCta } from './sections/landing-cta';
import { LandingFooter } from './sections/landing-footer';

export const LandingPage = () => {
  return (
    <ForceLightTheme>
      <LandingNav />
      <main>
        <LandingHero />
        <LandingShowcase />
        <LandingFeaturesSection />
        <LandingCta />
      </main>
      <LandingFooter />
    </ForceLightTheme>
  );
};
