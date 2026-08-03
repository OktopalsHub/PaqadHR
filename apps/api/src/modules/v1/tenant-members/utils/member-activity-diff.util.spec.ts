import { describeChangedFields, pickChangedFields } from './member-activity-diff.util';

describe('pickChangedFields', () => {
  it('returns only keys that differ', () => {
    expect(
      pickChangedFields(
        { role: 'member', department: 'Engineering', reportsTo: 'None' },
        { role: 'admin', department: 'Engineering', reportsTo: 'Jane Doe' },
      ),
    ).toEqual({
      beforeData: { role: 'member', reportsTo: 'None' },
      afterData: { role: 'admin', reportsTo: 'Jane Doe' },
    });
  });
});

describe('describeChangedFields', () => {
  it('formats readable field lists', () => {
    expect(describeChangedFields(['role'])).toBe('role');
    expect(describeChangedFields(['role', 'department'])).toBe('role and department');
    expect(describeChangedFields(['role', 'department', 'reportsTo'])).toBe(
      'role, department, and manager',
    );
  });
});
