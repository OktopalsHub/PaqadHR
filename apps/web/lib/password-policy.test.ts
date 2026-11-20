import assert from 'node:assert/strict';
import test from 'node:test';

import { isValidPassword } from './password-policy';

test('accepts any password with at least 8 characters', () => {
  assert.equal(isValidPassword('password'), true);
  assert.equal(isValidPassword('a1!B2@c3'), true);
  assert.equal(isValidPassword('short'), false);
  assert.equal(isValidPassword(''), false);
});
