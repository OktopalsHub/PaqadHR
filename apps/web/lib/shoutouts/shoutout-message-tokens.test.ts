import assert from 'node:assert/strict';
import test from 'node:test';
import type { ShoutoutLookupItem } from './parse-shoutout.ts';
import { tokenizeShoutoutMessage } from './shoutout-message-tokens.ts';

const employees: ShoutoutLookupItem[] = [
  { id: 'joy-1', name: 'Joy Ibini' },
  { id: 'dan-1', name: 'Dan Smith' },
];

test('renders a full-name mention as a single token followed by one text token', () => {
  const tokens = tokenizeShoutoutMessage('@Joy Ibini +10', employees, []);

  assert.deepEqual(tokens, [
    { type: 'mention', text: 'Joy Ibini', id: 'joy-1' },
    { type: 'text', text: ' ' },
    { type: 'points', text: '+10' },
  ]);
});

test('does not duplicate an emoji-free text segment', () => {
  const tokens = tokenizeShoutoutMessage('@Joy Ibini great work!', employees, []);

  const textTokens = tokens.filter((token) => token.type === 'text');
  assert.equal(textTokens.length, 1);
  assert.equal(textTokens[0].type === 'text' ? textTokens[0].text : '', ' great work!');
});

test('matches the longest name when members share prefixes', () => {
  const staff: ShoutoutLookupItem[] = [
    { id: 'ann-1', name: 'Ann Lee' },
    { id: 'ann-2', name: 'Ann Lee-Marley' },
  ];
  const tokens = tokenizeShoutoutMessage('thanks @Ann Lee-Marley', staff, []);
  const mentions = tokens.filter((token) => token.type === 'mention');
  assert.equal(mentions.length, 1);
  const mention = mentions[0];
  assert.equal(mention.type === 'mention' ? mention.id : '', 'ann-2');
});

test('resolves an unambiguous first-name mention to the full display name', () => {
  const tokens = tokenizeShoutoutMessage('nice @Dan!', employees, []);
  assert.deepEqual(tokens, [
    { type: 'text', text: 'nice ' },
    { type: 'mention', text: 'Dan Smith', id: 'dan-1' },
    { type: 'text', text: '!' },
  ]);
});

test('keeps unknown mentions as plain text', () => {
  const tokens = tokenizeShoutoutMessage('ping @Ghost Rider now', employees, []);
  assert.ok(tokens.every((token) => token.type === 'text'));
  const joined = tokens.map((token) => token.text).join('');
  assert.equal(joined, 'ping @Ghost Rider now');
});

test('keeps emails as plain text', () => {
  const tokens = tokenizeShoutoutMessage('mail support@company.com today', employees, []);
  assert.deepEqual(tokens, [{ type: 'text', text: 'mail support@company.com today' }]);
});

test('tokenizes categories and points alongside mentions', () => {
  const categories: ShoutoutLookupItem[] = [{ id: 'cat-1', name: 'Teamwork' }];
  const tokens = tokenizeShoutoutMessage('@Joy Ibini #Teamwork +20', employees, categories);

  assert.deepEqual(tokens, [
    { type: 'mention', text: 'Joy Ibini', id: 'joy-1' },
    { type: 'text', text: ' ' },
    { type: 'category', text: 'Teamwork', id: 'cat-1' },
    { type: 'text', text: ' ' },
    { type: 'points', text: '+20' },
  ]);
});
