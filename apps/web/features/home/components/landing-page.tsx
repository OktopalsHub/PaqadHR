import dynamic from 'next/dynamic';
import { ForceLightTheme } from '@/providers/force-light-theme';
import { LandingFaq } from './sections/landing-faq';
import { LandingNav } from './sections/landing-nav';

function SectionFallback() {
  return <div className="w-full h-64 animate-pulse bg-muted/30" />;
}

const LandingHero = dynamic(() => import('./sections/landing-hero').then((m) => m.LandingHero), {
  loading: SectionFallback,
});
const LandingFeaturesSection = dynamic(
  () => import('./sections/landing-features-section').then((m) => m.LandingFeaturesSection),
  { loading: SectionFallback },
);
const LandingShowcase = dynamic(
  () => import('./sections/landing-showcase').then((m) => m.LandingShowcase),
  { loading: SectionFallback },
);
const LandingCta = dynamic(() => import('./sections/landing-cta').then((m) => m.LandingCta), {
  loading: SectionFallback,
});
const LandingFooter = dynamic(
  () => import('./sections/landing-footer').then((m) => m.LandingFooter),
  { loading: SectionFallback },
);

export const LandingPage = () => {
  return (
    <ForceLightTheme>
      <LandingNav />
      <main>
        <LandingHero />
        <LandingShowcase />
        <LandingFeaturesSection />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
    </ForceLightTheme>
  );
};
