import assert from 'node:assert/strict';
import test from 'node:test';
import { getLeaveAssignmentPanelState } from './leave-assignment-panel-state.ts';

test('reports the fully configured state when there are no missing assignments', () => {
  const state = getLeaveAssignmentPanelState({
    year: 2026,
    isLoading: false,
    report: {
      tenantId: 'tenant-1',
      year: 2026,
      totalLeaveTypes: 4,
      totalMembers: 12,
      completeAssignments: 12,
      missingAssignments: [],
    },
  });

  assert.deepEqual(state, {
    kind: 'complete',
    title: 'All active members have every leave type assigned for 2026.',
    description: '12 of 12 members are fully configured.',
  });
});

test('reports missing-assignment totals and row counts for multiple missing leave types', () => {
  const state = getLeaveAssignmentPanelState({
    year: 2026,
    isLoading: false,
    report: {
      tenantId: 'tenant-1',
      year: 2026,
      totalLeaveTypes: 4,
      totalMembers: 10,
      completeAssignments: 7,
      missingAssignments: [
        {
          memberId: 'member-1',
          memberName: 'Ada Lovelace',
          missingTypes: [
            { leaveTypeId: 'annual', leaveTypeName: 'Annual Leave', defaultDays: 15 },
            { leaveTypeId: 'sick', leaveTypeName: 'Sick Leave', defaultDays: 10 },
          ],
        },
        {
          memberId: 'member-2',
          memberName: '',
          missingTypes: [
            { leaveTypeId: 'compassionate', leaveTypeName: 'Compassionate Leave', defaultDays: 5 },
          ],
        },
      ],
    },
  });

  assert.deepEqual(state, {
    kind: 'missing',
    totals: {
      members: 10,
      complete: 7,
      missing: 2,
    },
    rows: [
      {
        memberId: 'member-1',
        memberLabel: 'Ada Lovelace',
        missingTypes: [
          { leaveTypeId: 'annual', leaveTypeName: 'Annual Leave', defaultDays: 15 },
          { leaveTypeId: 'sick', leaveTypeName: 'Sick Leave', defaultDays: 10 },
        ],
        missingCount: 2,
      },
      {
        memberId: 'member-2',
        memberLabel: 'member-2',
        missingTypes: [
          { leaveTypeId: 'compassionate', leaveTypeName: 'Compassionate Leave', defaultDays: 5 },
        ],
        missingCount: 1,
      },
    ],
  });
});
