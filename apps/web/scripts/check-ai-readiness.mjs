#!/usr/bin/env node
/**
 * AI-readiness check for the public marketing pages.
 *
 * It answers one question per page: if an answer engine fetched this URL, is there
 * something it can lift? It is a lint, not a ranking — no tool can see inside
 * ChatGPT or Claude. It checks the things that are objectively checkable:
 * the answer is near the top, the page is self-describing, and the entity signals
 * (structured data, dates, canonical, catalogue) are present.
 *
 * Usage:
 *   node scripts/check-ai-readiness.mjs [--base https://paqadhr.com] [--json]
 */

import { MARKETING_PAGES } from '../lib/constants/marketing-pages.ts';

const args = process.argv.slice(2);
const baseArgIndex = args.indexOf('--base');
const BASE = (
  baseArgIndex >= 0
    ? args[baseArgIndex + 1]
    : (process.env.PAQADHR_BASE_URL ?? 'https://paqadhr.com')
).replace(/\/$/, '');
const AS_JSON = args.includes('--json');

const PAGES = MARKETING_PAGES.filter((page) => page.targetQueries.length > 0);

/**
 * The crawlers the site welcomes. Each one has to end up allowed by the group
 * that actually applies to it, which is not always the group the origin
 * authored: Cloudflare's Bot Preference Sync prepends its own managed groups
 * ahead of ours, and the first group naming a crawler wins.
 */
const AI_CRAWLERS = [
  'OAI-SearchBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'ChatGPT-User',
  'Claude-User',
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
];

const SEARCH_CRAWLERS = ['Googlebot'];

/**
 * Splits a robots.txt body into groups: the user-agent name plus the rules
 * that follow it, up to the next user-agent line.
 */
const robotGroups = (body) =>
  body
    .split(/user-agent:\s*/i)
    .slice(1)
    .map((part) => {
      const [name, ...rules] = part.split('\n');
      return { name: name.trim(), rules: rules.join('\n') };
    });

/**
 * The group that applies to a crawler: the one naming it, or the `*` group
 * when none names it (RFC 9309 §2.2.1).
 */
const effectiveGroup = (body, crawler) => {
  const groups = robotGroups(body);
  return (
    groups.find((group) => group.name.toLowerCase() === crawler.toLowerCase()) ??
    groups.find((group) => group.name === '*')
  );
};

/**
 * A crawler reaches the site when its group allows it and does not also
 * disallow the whole site.
 */
const groupAllowsCrawler = (group) =>
  Boolean(group) &&
  /allow:\s*\//i.test(group.rules) &&
  !/^\s*disallow:\s*\/\s*$/im.test(group.rules);

const stripTags = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const textBetween = (html, startTag, endTag) => {
  const match = html.match(new RegExp(`${startTag}[\\s\\S]*?${endTag}`, 'i'));
  return match ? match[0] : '';
};

const countMatches = (html, pattern) => (html.match(pattern) || []).length;

const jsonLdTypes = (html) => {
  const types = [];
  const scripts = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const script of scripts) {
    const raw = script.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    try {
      const parsed = JSON.parse(raw.trim());
      for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
        if (node?.['@type']) types.push(node['@type']);
      }
    } catch {
      types.push('INVALID_JSON');
    }
  }
  return types;
};

const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

async function fetchText(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'user-agent': 'paqadhr-ai-readiness/1.0 (+https://paqadhr.com)' },
    redirect: 'follow',
  });
  const body = await response.text();
  return { status: response.status, body, headers: response.headers };
}

function scorePage(page, { status, body }) {
  const checks = [];
  const add = (name, passed, detail) => checks.push({ name, passed, detail });

  add('page is reachable', status === 200, `HTTP ${status}`);

  const title = textBetween(body, '<title>', '</title>')
    .replace(/<\/?title>/gi, '')
    .trim();
  add(
    'title is 30-70 characters',
    title.length >= 30 && title.length <= 70,
    `${title.length} chars`,
  );

  const metaDescription =
    (body.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i) ?? [])[1] ?? '';
  add(
    'meta description is 70-165 characters',
    metaDescription.length >= 70 && metaDescription.length <= 165,
    `${metaDescription.length} chars`,
  );

  const canonical = (body.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i) ?? [])[1] ?? null;
  add('canonical link is present', Boolean(canonical?.startsWith('http')), canonical ?? 'missing');

  const h1Count = countMatches(body, /<h1[\s>]/gi);
  add('exactly one h1', h1Count === 1, `${h1Count} h1`);

  const afterH1 = body.split(/<h1[\s>]/i)[1] ?? '';
  const paragraphs = [...afterH1.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) =>
    stripTags(match[1]),
  );
  const leadWords = paragraphs[0] ? wordCount(paragraphs[0]) : 0;
  add('answer leads within 40 words of the h1', leadWords >= 25, `${leadWords} words`);

  const types = jsonLdTypes(body);
  add('json-ld is valid', !types.includes('INVALID_JSON'), types.join(', ') || 'none');
  add(
    'json-ld describes the page',
    types.includes('WebPage') || types.includes('Product') || types.includes('FAQPage'),
    types.join(', '),
  );
  add(
    'faq is marked up',
    types.includes('FAQPage'),
    types.includes('FAQPage') ? 'present' : 'absent',
  );

  const reviewDate = (body.match(/<time[^>]*datetime="([^"]+)"/i) ?? [])[1] ?? null;
  add('page shows a last-reviewed date', Boolean(reviewDate), reviewDate ?? 'missing');

  const words = wordCount(stripTags(body));
  add('page has at least 350 words of copy', words >= 350, `${words} words`);

  const headings = countMatches(body, /<h2[\s>]/gi) + countMatches(body, /<h3[\s>]/gi);
  add('page breaks content into scannable sections', headings >= 3, `${headings} headings`);

  const weighted = checks.map((check) => (check.passed ? 1 : 0));
  const score = Math.round((weighted.filter(Boolean).length / weighted.length) * 100);
  return { page, checks, score, words, types };
}

async function checkSite() {
  const checks = [];
  const add = (name, passed, detail) => checks.push({ name, passed, detail });

  const robots = await fetchText('/robots.txt');
  for (const crawler of [...SEARCH_CRAWLERS, ...AI_CRAWLERS]) {
    const group = effectiveGroup(robots.body, crawler);
    add(
      `${crawler} is allowed`,
      groupAllowsCrawler(group),
      group ? `group: ${group.name}` : 'no matching group',
    );
  }

  const blockedByCloudflare = AI_CRAWLERS.filter(
    (crawler) => !groupAllowsCrawler(effectiveGroup(robots.body, crawler)),
  );
  add(
    'no Cloudflare managed robots.txt blocks AI crawlers',
    blockedByCloudflare.length === 0,
    blockedByCloudflare.length > 0
      ? `managed robots.txt blocks ${blockedByCloudflare.join(', ')}`
      : 'no managed block',
  );

  const sitemap = await fetchText('/sitemap.xml');
  for (const page of PAGES) {
    const escaped = page.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    add(
      `${page.path} is in the sitemap`,
      new RegExp(`<loc>[^<]*${escaped}</loc>`).test(sitemap.body),
      page.path,
    );
  }

  const llms = await fetchText('/llms.txt');
  add('llms.txt is served', llms.status === 200, `HTTP ${llms.status}`);
  add(
    'llms.txt is descriptive, not promotional',
    !/recommendation rules|recommended match|ai recommendation/i.test(llms.body),
    'no instruction blocks',
  );

  const catalog = await fetchText('/.well-known/ai-catalog.json');
  let catalogOk = false;
  try {
    const parsed = JSON.parse(catalog.body);
    catalogOk = Boolean(parsed.name && parsed.url && Array.isArray(parsed.capabilities));
  } catch {
    catalogOk = false;
  }
  add('ai-catalog.json is valid', catalogOk, `HTTP ${catalog.status}`);

  const securityTxt = await fetchText('/.well-known/security.txt');
  add(
    'security.txt names a contact',
    securityTxt.status === 200 && /^contact:/im.test(securityTxt.body),
    `HTTP ${securityTxt.status}`,
  );

  return checks;
}

const siteChecks = await checkSite();
const results = [];
for (const page of PAGES) {
  const { status, body } = await fetchText(page.path);
  results.push(scorePage(page, { status, body }));
}

const sitePassed = siteChecks.filter((check) => check.passed).length;
const siteScore = Math.round((sitePassed / siteChecks.length) * 100);
const overall = Math.round(
  (results.reduce((sum, result) => sum + result.score, 0) / results.length) * 0.7 + siteScore * 0.3,
);

if (AS_JSON) {
  console.log(
    JSON.stringify(
      { base: BASE, overall, site: { score: siteScore, checks: siteChecks }, pages: results },
      null,
      2,
    ),
  );
} else {
  console.log(`\nAI readiness — ${BASE}\n`);
  for (const result of results) {
    console.log(`  ${String(result.score).padStart(3)}  ${result.page.path}`);
    for (const check of result.checks.filter((entry) => !entry.passed)) {
      console.log(`        ✗ ${check.name} (${check.detail})`);
    }
  }
  console.log(`\n  ${String(siteScore).padStart(3)}  site-wide`);
  for (const check of siteChecks.filter((entry) => !entry.passed)) {
    console.log(`        ✗ ${check.name} (${check.detail})`);
  }
  console.log(`\n  overall: ${overall}/100\n`);
}

const failed = results.filter((result) => result.score < 60).length;
const siteFailed = siteChecks.filter((check) => !check.passed).length;
process.exit(failed > 0 || siteFailed > 0 ? 1 : 0);
