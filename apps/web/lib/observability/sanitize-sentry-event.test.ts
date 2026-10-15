import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeSentryEvent } from './sanitize-sentry-event.ts';

test('removes credentials from browser Sentry event text', () => {
  const event = sanitizeSentryEvent({
    message: [
      'Authorization: Basic dXNlcjpwYXNzd29yZA==',
      'Cookie: session=super-secret',
      'password=super-secret api_key=sk_live_abcdefghijklmno',
      'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature',
    ].join('\n'),
  });

  assert.ok(!event.message?.includes('dXNlcjpwYXNzd29yZA=='));
  assert.ok(!event.message?.includes('super-secret'));
  assert.ok(!event.message?.includes('sk_live_abcdefghijklmno'));
  assert.ok(!event.message?.includes('eyJhbGciOiJIUzI1NiJ9'));
  assert.match(event.message ?? '', /Authorization: \[redacted\]/);
  assert.match(event.message ?? '', /Cookie: \[redacted\]/);
});
