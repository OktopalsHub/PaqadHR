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
  const createService = () => {
    const platformIntegrationService = {
      isShoutoutSlackConfigured: jest.fn().mockResolvedValue(false),
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

    const categoriesService = {
      resolveCategoryIds: jest.fn().mockResolvedValue([]),
    } as unknown as ShoutoutCategoriesService;

    const dataSource = {
      transaction: jest.fn().mockRejectedValue(new Error('reached-transaction')),
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

    return { service, platformIntegrationService };
  };

  it('does not reject API shoutouts when Slack is not configured', async () => {
    const { service } = createService();

    await expect(
      service.createShoutout('tenant-1', 'member-1', {
        recipients: [{ recipientId: 'member-2', points: 10 }],
        message: 'Great job',
        source: 'api',
      }),
    ).rejects.toThrow('reached-transaction');
  });
});
