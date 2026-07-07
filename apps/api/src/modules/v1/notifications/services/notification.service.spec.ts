import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { Notification } from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { NotificationService } from './notification.service';
import { SSENotificationService } from './sse-notification.service';
import { ZeptomailEmailService } from './zeptomail-email.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let tenantMembersService: {
    memberExistsInTenant: jest.Mock;
    filterTenantMemberIds: jest.Mock;
  };
  let notificationRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    tenantMembersService = {
      memberExistsInTenant: jest.fn(),
      filterTenantMemberIds: jest.fn(),
    };
    notificationRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (notification) => ({ id: 'n1', ...notification })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: notificationRepository },
        { provide: getRepositoryToken(NotificationPreference), useValue: {} },
        { provide: ZeptomailEmailService, useValue: { sendEmail: jest.fn() } },
        { provide: SSENotificationService, useValue: { sendToUser: jest.fn() } },
        { provide: TenantMembersService, useValue: tenantMembersService },
      ],
    }).compile();

    service = module.get(NotificationService);
    jest.spyOn(service as any, 'sendNotification').mockResolvedValue(undefined);
  });

  it('creates notification when recipient is a tenant member', async () => {
    tenantMembersService.memberExistsInTenant.mockResolvedValue(true);

    const result = await service.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.IN_APP,
      title: 'Hello',
      message: 'World',
      tenantId: 'tenant-1',
      recipientId: 'member-1',
    });

    expect(result.recipientId).toBe('member-1');
    expect(tenantMembersService.memberExistsInTenant).toHaveBeenCalledWith('tenant-1', 'member-1');
  });

  it('rejects notification when recipient is not a tenant member', async () => {
    tenantMembersService.memberExistsInTenant.mockResolvedValue(false);

    await expect(
      service.createNotification({
        type: NotificationType.USER,
        channel: NotificationChannel.IN_APP,
        title: 'Hello',
        message: 'World',
        tenantId: 'tenant-1',
        recipientId: 'member-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('validates bulk recipients with one membership query', async () => {
    tenantMembersService.filterTenantMemberIds.mockResolvedValue(new Set(['member-1']));

    await expect(
      service.createBulkNotifications({
        tenantId: 'tenant-1',
        recipientIds: ['member-1', 'member-2'],
        channel: NotificationChannel.IN_APP,
        title: 'Hello',
        message: 'World',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(tenantMembersService.filterTenantMemberIds).toHaveBeenCalledWith('tenant-1', [
      'member-1',
      'member-2',
    ]);
  });
});
