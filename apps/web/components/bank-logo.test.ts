import assert from 'node:assert/strict';
import test from 'node:test';
import { fallbackSafeBankName } from './bank-logo';

test('removes XML-reserved characters before generating an SVG fallback', () => {
  assert.equal(fallbackSafeBankName('A & B <Bank>'), 'A   B  Bank ');
});
