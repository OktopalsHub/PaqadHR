'use client';

import { useLinkStatus } from 'next/link';

/**
 * Must render inside a `<Link>`. The spinner only appears after a short delay,
 * so quick navigations stay clean and slow ones get immediate feedback.
 */
export function NavLinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`ml-auto size-3.5 shrink-0 rounded-full border-2 border-muted-foreground/30 border-t-primary transition-opacity ${
        pending ? 'animate-spin opacity-100 delay-150 duration-150' : 'opacity-0'
      }`}
    />
  );
}
