import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ENVIRONMENT } from 'src/common/config/env.config';
import { NotificationChannel } from 'src/common/enums/notification-channel.enum';
import { NotificationPreferenceType } from 'src/common/enums/notification-preference-type.enum';
import { NotificationPriority } from 'src/common/enums/notification-priority.enum';
import { NotificationType } from 'src/common/enums/notification-type.enum';
import { IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { NotificationService } from '../../notifications/services/notification.service';
import { NotificationPreferenceService } from '../../notifications/services/notification-preference.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { TenantsService } from '../../tenants/tenants.service';
import { TenantCalendarEvent } from '../entities/tenant-calendar-event.entity';
import {
  eventStartAtUtc,
  formatEventStartLabel,
  formatReminderLeadLabel,
  isReminderDue,
  reminderAtUtc,
} from '../utils/calendar-event-schedule.util';

@Injectable()
export class CalendarEventReminderService {
  constructor(
    @InjectRepository(TenantCalendarEvent)
    private readonly eventRepository: Repository<TenantCalendarEvent>,
    private readonly tenantMembersService: TenantMembersService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly tenantsService: TenantsService,
    private readonly notificationService: NotificationService,
    private readonly notificationPreferenceService: NotificationPreferenceService,
  ) {}

  async processDueReminders(): Promise<{ sent: number; skipped: number; expired: number }> {
    const now = new Date();
    const lookback = new Date(now);
    lookback.setDate(lookback.getDate() - 2);
    const lookahead = new Date(now);
    lookahead.setDate(lookahead.getDate() + 30);

    const candidates = await this.eventRepository.find({
      where: {
        reminderMinutes: Not(IsNull()),
        reminderSentAt: IsNull(),
        startDate: MoreThanOrEqual(lookback.toISOString().slice(0, 10)),
      },
      relations: ['tenant', 'creator'],
      order: { startDate: 'ASC' },
    });

    const timezoneCache = new Map<string, string>();
    let sent = 0;
    let skipped = 0;
    let expired = 0;

    for (const event of candidates) {
      if (event.reminderMinutes == null) {
        skipped += 1;
        continue;
      }

      if (event.startDate.slice(0, 10) > lookahead.toISOString().slice(0, 10)) {
        continue;
      }

      const timezone = await this.resolveTenantTimezone(event.tenantId, timezoneCache);
      const startAt = eventStartAtUtc(event, timezone);
      const reminderAt = reminderAtUtc(event, timezone);

      if (!reminderAt) {
        skipped += 1;
        continue;
      }

      if (now.getTime() >= startAt.getTime()) {
        await this.markReminderHandled(event.id);
        expired += 1;
        continue;
      }

      if (now.getTime() >= reminderAt.getTime() + 5 * 60 * 1000) {
        await this.markReminderHandled(event.id);
        expired += 1;
        continue;
      }

      if (!isReminderDue(reminderAt, startAt, now)) {
        continue;
      }

      const delivered = await this.sendEventReminder(event, timezone);
      await this.markReminderHandled(event.id);
      sent += delivered > 0 ? 1 : 0;
      if (delivered === 0) skipped += 1;
    }

    return { sent, skipped, expired };
  }

  private async resolveTenantTimezone(
    tenantId: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const cached = cache.get(tenantId);
    if (cached) return cached;

    try {
      const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const timezone = settings.settings.general?.timezone?.trim() || 'UTC';
      cache.set(tenantId, timezone);
      return timezone;
    } catch {
      cache.set(tenantId, 'UTC');
      return 'UTC';
    }
  }

  private async sendEventReminder(event: TenantCalendarEvent, timezone: string): Promise<number> {
    const members = await this.tenantMembersService.getTenantMembers(event.tenantId);
    const activeMembers = members.filter((member) => member.isActive && member.userId);
    if (activeMembers.length === 0) return 0;

    const tenant = event.tenant ?? (await this.tenantsService.getTenant(event.tenantId));
    const scheduleUrl = `${ENVIRONMENT.APP.FRONTEND_URL.replace(/\/$/, '')}/${tenant.slug}/schedule`;
    const startLabel = formatEventStartLabel(event, timezone);
    const leadLabel = formatReminderLeadLabel(event.reminderMinutes ?? 0);
    const title = 'Schedule reminder';
    const message = `"${event.title}" ${leadLabel} (${startLabel})`;

    let delivered = 0;

    for (const member of activeMembers) {
      const channel = await this.resolveReminderChannel(member.id);
      if (!channel) continue;

      await this.notificationService.createNotification({
        type: NotificationType.USER,
        channel,
        priority: NotificationPriority.HIGH,
        title,
        message,
        recipientId: member.id,
        tenantId: event.tenantId,
        actionData: {
          url: scheduleUrl,
          buttonText: 'Open schedule',
          actionType: 'navigate',
        },
        metadata: {
          type: 'calendar_event_reminder',
          eventId: event.id,
          eventTitle: event.title,
          startLabel,
          reminderMinutes: event.reminderMinutes,
        },
      });
      delivered += 1;
    }

    return delivered;
  }

  private async resolveReminderChannel(
    tenantMemberId: string,
  ): Promise<NotificationChannel | null> {
    const preference = await this.notificationPreferenceService.getPreference(
      tenantMemberId,
      NotificationPreferenceType.MEETING_REMINDER,
    );

    if (preference && !preference.isEnabled) {
      return null;
    }

    const emailEnabled = preference?.emailEnabled ?? true;
    const inAppEnabled = preference?.inAppEnabled ?? true;

    if (!emailEnabled && !inAppEnabled) {
      return null;
    }

    const emailAllowed = await this.notificationPreferenceService.shouldSendNotification(
      tenantMemberId,
      NotificationPreferenceType.MEETING_REMINDER,
      NotificationChannel.EMAIL,
    );
    const inAppAllowed = await this.notificationPreferenceService.shouldSendNotification(
      tenantMemberId,
      NotificationPreferenceType.MEETING_REMINDER,
      NotificationChannel.IN_APP,
    );

    const canEmail = emailEnabled && emailAllowed;
    const canInApp = inAppEnabled && inAppAllowed;

    if (canEmail && canInApp) return NotificationChannel.BOTH;
    if (canEmail) return NotificationChannel.EMAIL;
    if (canInApp) return NotificationChannel.IN_APP;
    return null;
  }

  private async markReminderHandled(eventId: string): Promise<void> {
    await this.eventRepository.update({ id: eventId }, { reminderSentAt: new Date() });
  }
}
