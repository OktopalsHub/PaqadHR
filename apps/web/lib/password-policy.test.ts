import assert from 'node:assert/strict';
import test from 'node:test';
import { isStrongPassword } from './password-policy';

test('accepts only passwords that meet every requirement', () => {
  assert.equal(isStrongPassword('StrongPass1!'), true);
  assert.equal(isStrongPassword('lowercase1!'), false);
  assert.equal(isStrongPassword('UPPERCASE1!'), false);
  assert.equal(isStrongPassword('StrongPassword!'), false);
  assert.equal(isStrongPassword('StrongPassword1'), false);
  assert.equal(isStrongPassword('Short1!'), false);
  assert.equal(isStrongPassword('Strong Pass1!'), false);
});
