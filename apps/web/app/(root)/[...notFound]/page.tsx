import { notFound } from 'next/navigation';

/**
 * Catch-all for unmatched URLs.
 *
 * Without this, a dynamic segment with a layout but no page (e.g. `/[tenantSlug]`)
 * can render the not-found UI with a 200 status, which lets crawlers index junk
 * addresses. Calling `notFound()` here makes Next render `app/not-found.tsx`
 * with a real 404 response.
 */
export default function NotFoundCatchAll() {
  notFound();
}
