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
  let tenantMembersService: { findUserTenantMembership: jest.Mock };
  let notificationRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    tenantMembersService = {
      findUserTenantMembership: jest.fn(),
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
    tenantMembersService.findUserTenantMembership.mockResolvedValue({ id: 'member-1' });

    const result = await service.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.IN_APP,
      title: 'Hello',
      message: 'World',
      tenantId: 'tenant-1',
      recipientId: 'user-1',
    });

    expect(result.recipientId).toBe('user-1');
    expect(tenantMembersService.findUserTenantMembership).toHaveBeenCalledWith(
      'user-1',
      'tenant-1',
    );
  });

  it('rejects notification when recipient is not a tenant member', async () => {
    tenantMembersService.findUserTenantMembership.mockResolvedValue(null);

    await expect(
      service.createNotification({
        type: NotificationType.USER,
        channel: NotificationChannel.IN_APP,
        title: 'Hello',
        message: 'World',
        tenantId: 'tenant-1',
        recipientId: 'user-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
