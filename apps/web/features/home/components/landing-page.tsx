import { LandingCapabilities } from './sections/landing-capabilities';
import { LandingCta } from './sections/landing-cta';
import { LandingFooter } from './sections/landing-footer';
import { LandingHero } from './sections/landing-hero';
import { LandingNav } from './sections/landing-nav';

export const LandingPage = () => {
  return (
    <div className="theme-marketing min-h-screen bg-background text-foreground">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingCapabilities />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
};
