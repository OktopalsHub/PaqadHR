import { UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlatformIntegrationService } from 'src/common/integrations/services/platform-integration.service';
import { DataSource } from 'typeorm';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { ShoutoutsRepository } from '../repositories/shoutouts.repository';
import { MemberPointsService } from './member-points.service';
import { ShoutoutCategoriesService } from './shoutout-categories.service';
import { ShoutoutsService } from './shoutouts.service';

describe('ShoutoutsService Slack gating', () => {
  const createService = (configured: boolean) => {
    const platformIntegrationService = {
      isShoutoutSlackConfigured: jest.fn().mockResolvedValue(configured),
    } as unknown as PlatformIntegrationService;

    const tenantSettingsService = {
      getTenantSettings: jest.fn().mockResolvedValue({
        settings: {
          points: { minPointsPerShoutout: 1, maxPointsPerShoutout: 100 },
          shoutouts: { maxRecipientsPerShoutout: 5, enableCategories: false },
        },
      }),
    } as unknown as TenantSettingsService;

    const tenantMembersService = {
      getTenantMemberId: jest.fn().mockResolvedValue('member-2'),
    } as unknown as TenantMembersService;

    const service = new ShoutoutsService(
      {} as ShoutoutsRepository,
      {} as MemberPointsService,
      {} as ShoutoutCategoriesService,
      tenantSettingsService,
      tenantMembersService,
      {} as NotificationHelperService,
      {} as EventEmitter2,
      {} as DataSource,
      platformIntegrationService,
    );

    return { service, platformIntegrationService };
  };

  it('rejects API shoutouts when Slack is not configured', async () => {
    const { service } = createService(false);

    await expect(
      service.createShoutout('tenant-1', 'member-1', {
        recipientIds: ['member-2'],
        pointsPerRecipient: 10,
        message: 'Great job',
        source: 'api',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('skips Slack status check for slack-originated shoutouts', async () => {
    const platformIntegrationService = {
      isShoutoutSlackConfigured: jest.fn().mockResolvedValue(false),
    } as unknown as PlatformIntegrationService;

    const categoriesService = {
      resolveCategoryIds: jest.fn().mockResolvedValue([]),
    } as unknown as ShoutoutCategoriesService;

    const tenantSettingsService = {
      getTenantSettings: jest.fn().mockResolvedValue({
        settings: {
          points: { minPointsPerShoutout: 1, maxPointsPerShoutout: 100 },
          shoutouts: { maxRecipientsPerShoutout: 5, enableCategories: false },
        },
      }),
    } as unknown as TenantSettingsService;

    const tenantMembersService = {
      getTenantMemberId: jest.fn().mockResolvedValue('member-2'),
    } as unknown as TenantMembersService;

    const dataSource = {
      transaction: jest.fn().mockRejectedValue(new Error('stop-after-slack-check')),
    } as unknown as DataSource;

    const service = new ShoutoutsService(
      {} as ShoutoutsRepository,
      {} as MemberPointsService,
      categoriesService,
      tenantSettingsService,
      tenantMembersService,
      {} as NotificationHelperService,
      {} as EventEmitter2,
      dataSource,
      platformIntegrationService,
    );

    await expect(
      service.createShoutout('tenant-1', 'member-1', {
        recipientIds: ['member-2'],
        pointsPerRecipient: 10,
        message: 'Great job',
        source: 'slack',
      }),
    ).rejects.toThrow('stop-after-slack-check');

    expect(platformIntegrationService.isShoutoutSlackConfigured).not.toHaveBeenCalled();
  });
});
