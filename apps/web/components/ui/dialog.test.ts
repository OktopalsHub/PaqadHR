import assert from 'node:assert/strict';
import test from 'node:test';
import { hasExplicitAriaDescribedBy } from './dialog';

test('recognizes an explicit undefined aria-describedby override', () => {
  assert.equal(hasExplicitAriaDescribedBy({}), false);
  assert.equal(hasExplicitAriaDescribedBy({ 'aria-describedby': undefined }), true);
});
