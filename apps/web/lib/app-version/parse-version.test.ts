import assert from 'node:assert/strict';
import test from 'node:test';
import { parseVersionBuildId } from './parse-version.ts';

test('parseVersionBuildId accepts only { buildId: string }', () => {
  assert.equal(parseVersionBuildId({ buildId: 'abc123' }), 'abc123');
});

test('parseVersionBuildId rejects unknown fields and bad shapes', () => {
  assert.equal(parseVersionBuildId({ buildId: 'abc', builtAt: 'x' }), null);
  assert.equal(parseVersionBuildId({ buildId: 1 }), null);
  assert.equal(parseVersionBuildId({ buildId: '' }), null);
  assert.equal(parseVersionBuildId({}), null);
  assert.equal(parseVersionBuildId(null), null);
  assert.equal(parseVersionBuildId([{ buildId: 'x' }]), null);
});
