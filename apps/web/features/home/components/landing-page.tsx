import { LandingNav } from "./sections/landing-nav";
import { LandingHero } from "./sections/landing-hero";
import { LandingFeatures } from "./sections/landing-features";
import { LandingHowItWorks } from "./sections/landing-how-it-works";
import { LandingCta } from "./sections/landing-cta";
import { LandingFooter } from "./sections/landing-footer";

export const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
};
