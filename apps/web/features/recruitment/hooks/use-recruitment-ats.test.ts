import assert from 'node:assert/strict';
import test from 'node:test';

import { atsKeys } from './use-recruitment-ats.ts';

test('ATS query keys differ per workspace so a switch never serves the previous tenant', () => {
  for (const key of [atsKeys.templates, atsKeys.variables, atsKeys.pipeline]) {
    assert.notDeepEqual(key('tenant-a'), key('tenant-b'));
  }
});
