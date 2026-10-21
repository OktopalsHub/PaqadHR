import type { MetadataRoute } from 'next';
import { COMPANY } from '@/lib/constants/company';

/**
 * App routes that are never public. Every named crawler group repeats this list:
 * once a bot has its own group, the `*` group no longer applies to it.
 */
const APP_DISALLOW = [
  '/api/',
  '/signin',
  '/signup',
  '/onboarding',
  '/app',
  '/dashboard',
  '/*/activity',
  '/*/analytics',
  '/*/attendance',
  '/*/calendar',
  '/*/employees',
  '/*/integrations',
  '/*/leaves',
  '/*/logs',
  '/*/payroll',
  '/*/recruitment',
  '/*/rewards',
  '/*/schedule',
  '/*/settings',
  '/*/shoutouts',
  '/*/subscribe',
  '/*/teams',
];

/**
 * Crawlers are split by what they do with the page, because that is the axis a
 * policy change actually moves along:
 *
 * - `SEARCH_CRAWLERS` build the classic web index.
 * - `AI_CITATION_CRAWLERS` decide whether a page can appear in an AI answer:
 *   `OAI-SearchBot` for ChatGPT Search, `Claude-SearchBot` for Claude's search
 *   features, `PerplexityBot` for Perplexity.
 * - `AI_USER_CRAWLERS` fetch a page on a user's behalf, on demand, when someone
 *   asks the assistant to read it: `ChatGPT-User`, `Claude-User`.
 * - `AI_TRAINING_CRAWLERS` build training corpora: `GPTBot`, `ClaudeBot`,
 *   `Google-Extended`. They do not affect search citations, but they do affect
 *   whether a model knows the brand exists.
 *
 * Every one of them is allowed on purpose. Change that split here, in one place,
 * if the policy changes.
 */
const SEARCH_CRAWLERS = ['Googlebot', 'Bingbot', 'Applebot'] as const;
const AI_CITATION_CRAWLERS = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'] as const;
const AI_USER_CRAWLERS = ['ChatGPT-User', 'Claude-User'] as const;
const AI_TRAINING_CRAWLERS = ['GPTBot', 'ClaudeBot', 'Google-Extended'] as const;

/**
 * Crawlers that get a group of their own. A named group wins over the `*` group
 * for the crawlers it names (RFC 9309 §2.2.1), so each one repeats
 * `APP_DISALLOW` rather than inheriting it.
 */
const ALLOWED_CRAWLERS = [
  ...SEARCH_CRAWLERS,
  ...AI_CITATION_CRAWLERS,
  ...AI_USER_CRAWLERS,
  ...AI_TRAINING_CRAWLERS,
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: APP_DISALLOW,
      },
      ...ALLOWED_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: APP_DISALLOW,
      })),
    ],
    sitemap: `${COMPANY.website}/sitemap.xml`,
    // The `Host` directive takes a hostname, not a URL. `COMPANY.website` is a
    // URL, so strip the scheme rather than publishing `Host: https://paqadhr.com`.
    host: new URL(COMPANY.website).host,
  };
}
