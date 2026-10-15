import { ActivitiesService } from '../../activities/services/activities.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type { ShoutoutCreatedEventPayload } from '../events/shoutout.events';
import { ShoutoutAuditService } from '../services/shoutout-audit.service';
import { ShoutoutAuditListener } from './shoutout-audit.listener';

describe('ShoutoutAuditListener activity description', () => {
  const basePayload: ShoutoutCreatedEventPayload = {
    tenantId: 'tenant-1',
    shoutoutId: 'shoutout-1',
    senderMemberId: 'member-1',
    senderUserId: null,
    recipients: [
      { recipientId: 'member-2', points: 10 },
      { recipientId: 'member-3', points: 5 },
    ],
    recipientIds: ['member-2', 'member-3'],
    totalPoints: 15,
    message: 'Great job',
    categoryNames: ['Teamwork'],
    source: 'api',
  };

  const createListener = (
    getTenantMembersByIds: jest.Mock,
  ): {
    listener: ShoutoutAuditListener;
    logShoutoutCreated: jest.Mock;
    queueActivity: jest.Mock;
  } => {
    const logShoutoutCreated = jest.fn().mockResolvedValue(undefined);

    const queueActivity = jest.fn().mockResolvedValue(undefined);

    const listener = new ShoutoutAuditListener(
      { logShoutoutCreated } as unknown as ShoutoutAuditService,
      { queueActivity } as unknown as ActivitiesService,
      { getTenantMembersByIds } as unknown as TenantMembersService,
    );

    return { listener, logShoutoutCreated, queueActivity };
  };

  it('looks up recipients scoped to the tenant and uses formatted names', async () => {
    const getTenantMembersByIds = jest
      .fn()
      .mockResolvedValue([{ firstName: 'Jane', lastName: 'Doe' }, { preferredName: 'Sam' }]);
    const { listener, queueActivity, logShoutoutCreated } = createListener(getTenantMembersByIds);

    await listener.handleShoutoutCreated(basePayload);

    expect(logShoutoutCreated).toHaveBeenCalledWith(basePayload);
    expect(getTenantMembersByIds).toHaveBeenCalledWith('tenant-1', ['member-2', 'member-3']);
    expect(queueActivity).toHaveBeenCalledTimes(1);
    expect(queueActivity.mock.calls[0][0].description).toBe(
      'Gave a shoutout to Jane Doe, Sam (15 points)',
    );
  });

  it('falls back to the recipient count when no members resolve', async () => {
    const getTenantMembersByIds = jest.fn().mockResolvedValue([]);
    const { listener, queueActivity } = createListener(getTenantMembersByIds);

    await listener.handleShoutoutCreated(basePayload);

    expect(queueActivity).toHaveBeenCalledTimes(1);
    expect(queueActivity.mock.calls[0][0].description).toBe(
      'Gave a shoutout to 2 recipient(s) (15 points)',
    );
  });

  it('falls back to the recipient count when the member lookup fails', async () => {
    const getTenantMembersByIds = jest.fn().mockRejectedValue(new Error('db unavailable'));
    const { listener, queueActivity } = createListener(getTenantMembersByIds);

    await expect(listener.handleShoutoutCreated(basePayload)).resolves.toBeUndefined();

    expect(queueActivity).toHaveBeenCalledTimes(1);
    expect(queueActivity.mock.calls[0][0].description).toBe(
      'Gave a shoutout to 2 recipient(s) (15 points)',
    );
  });
});
