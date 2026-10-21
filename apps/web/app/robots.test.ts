import assert from 'node:assert/strict';
import test from 'node:test';
import robots from './robots';

type Rule = {
  userAgent?: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
};

const rules = robots().rules as Rule[];

/**
 * The crawlers the site promises to welcome, spelled the way they send
 * themselves. A crawler with no group of its own falls back to the `*` group,
 * so every one of these needs an explicit entry to be unambiguous.
 */
const REQUIRED_CRAWLERS = [
  'Googlebot',
  'Bingbot',
  'Applebot',
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Google-Extended',
];

const PRIVATE_ROUTES = ['/api/', '/signin', '/app', '/*/payroll', '/*/settings'];

const groupFor = (userAgent: string) => rules.find((rule) => rule.userAgent === userAgent);

const toArray = (value?: string | string[]) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

test('every major search and AI crawler is explicitly allowed', () => {
  for (const crawler of REQUIRED_CRAWLERS) {
    const group = groupFor(crawler);
    assert.ok(group, `${crawler} must have its own group`);
    assert.ok(toArray(group.allow).includes('/'), `${crawler} must be allowed to crawl the site`);
  }
});

test('the wildcard group still allows the public site', () => {
  const wildcard = groupFor('*');

  assert.ok(wildcard, 'the * group must exist');
  assert.deepEqual(toArray(wildcard.allow), ['/']);
});

test('private app routes stay disallowed for every crawler', () => {
  assert.ok(rules.length > 1);

  for (const rule of rules) {
    const userAgent = toArray(rule.userAgent).join(', ');
    const disallowed = toArray(rule.disallow);

    for (const route of PRIVATE_ROUTES) {
      assert.ok(disallowed.includes(route), `${userAgent} must disallow ${route}`);
    }
  }
});

test('the sitemap is published and the host is a hostname', () => {
  const metadata = robots();

  assert.equal(metadata.sitemap, 'https://paqadhr.com/sitemap.xml');
  assert.equal(metadata.host, 'paqadhr.com');
});
