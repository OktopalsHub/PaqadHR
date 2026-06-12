"use client";

import { useSyncExternalStore } from "react";
import { LandingNav } from "./sections/landing-nav";
import { LandingHero } from "./sections/landing-hero";
import { LandingStats } from "./sections/landing-stats";
import { LandingFeatures } from "./sections/landing-features";
import { LandingTestimonials } from "./sections/landing-testimonials";
import { LandingCta } from "./sections/landing-cta";
import { LandingFooter } from "./sections/landing-footer";

function subscribeToScroll(onStoreChange: () => void) {
  window.addEventListener("scroll", onStoreChange, { passive: true });
  return () => window.removeEventListener("scroll", onStoreChange);
}

function getScrollSnapshot() {
  return window.scrollY > 50;
}

export const LandingPage = () => {
  const isScrolled = useSyncExternalStore(
    subscribeToScroll,
    getScrollSnapshot,
    () => false,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 overflow-x-hidden">
      <LandingNav isScrolled={isScrolled} />
      <LandingHero />
      <LandingStats />
      <LandingFeatures />
      <LandingTestimonials />
      <LandingCta />
      <LandingFooter />
    </div>
  );
};
