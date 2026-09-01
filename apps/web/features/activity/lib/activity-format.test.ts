import assert from 'node:assert/strict';
import test from 'node:test';
import { UserRoundCheck, UserRoundX } from 'lucide-react';
import type { TenantActivity } from '../../../lib/api/activities.ts';
import {
  formatActivityChangePreview,
  formatActivityFieldValue,
  getActivityChangeEntries,
  getActivityDetailEntries,
  getActivityPresentation,
} from './activity-format.ts';

function activity(partial: Partial<TenantActivity>): TenantActivity {
  return {
    id: '1',
    tenantId: 't1',
    actorMemberId: 'm1',
    actorName: 'Daniel Doe',
    actorAvatarUrl: null,
    action: 'member.updated',
    resourceType: 'member',
    resourceId: 'uuid',
    description: "Updated Jane Smith's role",
    status: 'SUCCESS',
    severity: 'LOW',
    metadata: null,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

test('formatActivityFieldValue humanizes role-like tokens', () => {
  assert.equal(formatActivityFieldValue('member'), 'Member');
  assert.equal(formatActivityFieldValue('on_leave'), 'On leave');
});

test('formatActivityChangePreview labels before and after explicitly', () => {
  const item = activity({
    metadata: {
      beforeData: { role: 'member' },
      afterData: { role: 'admin' },
      memberId: 'should-hide',
    },
  });
  assert.equal(formatActivityChangePreview(item), 'Role: before Member, after Admin');
  assert.deepEqual(getActivityChangeEntries(item), [
    { field: 'Role', from: 'Member', to: 'Admin' },
  ]);
  assert.deepEqual(getActivityDetailEntries(item), []);
});

test('getActivityDetailEntries keeps useful details and hides id fields', () => {
  const item = activity({
    action: 'leave.approved',
    metadata: {
      leaveType: 'Annual',
      duration: 2,
      requesterId: 'uuid-hide-me',
    },
  });
  assert.deepEqual(getActivityDetailEntries(item), [
    { label: 'Leave Type', value: 'Annual' },
    { label: 'Duration', value: '2' },
  ]);
});

for (const action of ['member.deactivated', 'member.removed'] as const) {
  test(`${action} uses the destructive member-status presentation`, () => {
    const presentation = getActivityPresentation(
      activity({ action, description: 'Member status changed' }),
    );

    assert.equal(presentation.icon, UserRoundX);
    assert.equal(presentation.iconClassName, 'bg-destructive/10 text-destructive');
  });
}

test('member.reactivated uses the success member-status presentation', () => {
  const presentation = getActivityPresentation(
    activity({ action: 'member.reactivated', description: 'Member reactivated' }),
  );

  assert.equal(presentation.icon, UserRoundCheck);
  assert.equal(presentation.iconClassName, 'bg-emerald-500/10 text-emerald-700');
});
