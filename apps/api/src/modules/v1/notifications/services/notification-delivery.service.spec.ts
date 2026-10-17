import { NotificationChannel } from 'src/common/enums/notification-channel.enum';
import { NotificationStatus } from 'src/common/enums/notification-status.enum';
import type { Notification } from '../entities/notification.entity';
import { NotificationDeliveryService } from './notification-delivery.service';

function makeNotification(channel: NotificationChannel = NotificationChannel.EMAIL): Notification {
  return {
    id: 'notif-1',
    recipientId: 'member-1',
    tenantId: 'tenant-1',
    channel,
    title: 'Heads up',
    message: 'Something happened',
  } as Notification;
}

function build(update: jest.Mock, sendTemplateEmail: jest.Mock) {
  const repo = { update } as never;
  const service = new NotificationDeliveryService(
    { sendTemplateEmail } as never,
    { sendToUser: jest.fn(), sendToTenant: jest.fn(), sendSystemNotification: jest.fn() } as never,
    {
      getTenantMember: jest.fn().mockResolvedValue({ user: { email: 'user@example.com' } }),
    } as never,
  );
  return { service, repo };
}

describe('NotificationDeliveryService email failure handling', () => {
  it('marks FAILED when the provider reports success:false', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    // sendTemplateEmail returns a result object; it does not throw on provider failure.
    const sendTemplateEmail = jest
      .fn()
      .mockResolvedValue({ success: false, error: 'The sender email is not verified' });
    const { service, repo } = build(update, sendTemplateEmail);

    await service.deliver(repo, makeNotification());

    expect(update).toHaveBeenCalledWith(
      'notif-1',
      expect.objectContaining({ status: NotificationStatus.FAILED }),
    );
    expect(update).not.toHaveBeenCalledWith(
      'notif-1',
      expect.objectContaining({ status: NotificationStatus.SENT }),
    );
  });

  it('marks SENT when the provider reports success:true', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const sendTemplateEmail = jest.fn().mockResolvedValue({ success: true, messageId: 'tm-1' });
    const { service, repo } = build(update, sendTemplateEmail);

    await service.deliver(repo, makeNotification());

    expect(update).toHaveBeenCalledWith(
      'notif-1',
      expect.objectContaining({ status: NotificationStatus.SENT }),
    );
  });

  it('still marks SENT for an in-app-only notification with no email send', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const sendTemplateEmail = jest.fn();
    const { service, repo } = build(update, sendTemplateEmail);

    await service.deliver(repo, makeNotification(NotificationChannel.IN_APP));

    // No recipient email is needed for in-app delivery.
    expect(sendTemplateEmail).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      'notif-1',
      expect.objectContaining({ status: NotificationStatus.SENT }),
    );
  });

  it('marks FAILED when the recipient has no email on file', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const sendTemplateEmail = jest.fn();
    const service = new NotificationDeliveryService(
      { sendTemplateEmail } as never,
      {
        sendToUser: jest.fn(),
        sendToTenant: jest.fn(),
        sendSystemNotification: jest.fn(),
      } as never,
      { getTenantMember: jest.fn().mockResolvedValue({ user: { email: null } }) } as never,
    );

    await service.deliver({ update } as never, makeNotification());

    expect(sendTemplateEmail).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      'notif-1',
      expect.objectContaining({ status: NotificationStatus.FAILED }),
    );
  });
});
