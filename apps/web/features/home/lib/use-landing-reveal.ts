'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Adds `is-visible` once a section approaches the viewport.
 *
 * CSS owns the animation (see `.landing-reveal` in globals.css), so landing
 * sections do not need an animation library in the initial bundle.
 */
export function useLandingReveal<T extends HTMLElement = HTMLElement>(margin = '-60px') {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: margin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [margin]);

  return { ref, visible };
}
