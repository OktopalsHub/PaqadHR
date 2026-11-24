import { LeaveStatus } from 'src/common/enums';

import { AttendanceEligibilityService } from './attendance-eligibility.service';

describe('AttendanceEligibilityService.isOnLeave', () => {
  const build = (records: unknown[]) => {
    const getLeavesByMember = jest.fn().mockResolvedValue({ records });
    const service = new AttendanceEligibilityService({} as never, { getLeavesByMember } as never);
    return { service, getLeavesByMember };
  };

  it('asks for approved leave covering the day instead of scanning the first page', async () => {
    const { service, getLeavesByMember } = build([{ leaveType: { name: 'Annual' } }]);
    const result = await service.isOnLeave('t', 'm', new Date('2026-03-04T10:00:00Z'));
    expect(result).toEqual({ isOnLeave: true, leaveType: 'Annual' });
    expect(getLeavesByMember).toHaveBeenCalledWith(
      't',
      'm',
      { page: 1, limit: 1 },
      { status: LeaveStatus.APPROVED, from: '2026-03-04', to: '2026-03-04' },
    );
  });

  it('is not on leave when nothing matches', async () => {
    const { service } = build([]);
    expect((await service.isOnLeave('t', 'm', new Date())).isOnLeave).toBe(false);
  });
});
