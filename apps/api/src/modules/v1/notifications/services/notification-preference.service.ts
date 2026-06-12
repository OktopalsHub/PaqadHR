import { NotificationPreference } from '../entities/notification-preference.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreferenceType } from "../../../../common/enums/notification-preference-type.enum";
import { NotificationChannel } from "../../../../common/enums/notification-channel.enum";
import { UpdatePreferenceDto } from "../../../../common/interfaces/update-preference-dto.interface";

@Injectable()
export class NotificationPreferenceService {
  constructor(
    @InjectRepository(NotificationPreference)
    private preferenceRepository: Repository<NotificationPreference>,
  ) {}
  async getUserPreferences(
    tenantMemberId: string,
  ): Promise<NotificationPreference[]> {
    return this.preferenceRepository.find({
      where: { tenantMemberId },
      order: { notificationType: 'ASC' },
    });
  }
  async getPreference(
    tenantMemberId: string,
    notificationType: NotificationPreferenceType,
  ): Promise<NotificationPreference | null> {
    return this.preferenceRepository.findOne({
      where: { tenantMemberId, notificationType },
    });
  }
  async updatePreference(
    tenantMemberId: string,
    notificationType: NotificationPreferenceType,
    updateDto: UpdatePreferenceDto,
  ): Promise<NotificationPreference> {
    let preference = await this.getPreference(tenantMemberId, notificationType);
    if (!preference) {
      preference = this.preferenceRepository.create({
        tenantMemberId,
        notificationType,
        preferredChannel: NotificationChannel.BOTH,
        isEnabled: true,
        emailEnabled: true,
        inAppEnabled: true,
        ...updateDto,
      });
    } else {
      Object.assign(preference, updateDto);
    }
    return this.preferenceRepository.save(preference);
  }
  async updateMultiplePreferences(
    tenantMemberId: string,
    preferences: Array<
      { notificationType: NotificationPreferenceType } & UpdatePreferenceDto
    >,
  ): Promise<NotificationPreference[]> {
    const results: NotificationPreference[] = [];
    for (const pref of preferences) {
      const { notificationType, ...updateDto } = pref;
      const result = await this.updatePreference(
        tenantMemberId,
        notificationType,
        updateDto,
      );
      results.push(result);
    }
    return results;
  }
  async resetToDefaults(tenantMemberId: string): Promise<void> {
    await this.preferenceRepository.delete({ tenantMemberId });
  }
  async getDefaultPreferences(): Promise<
    Array<{ notificationType: string; defaultSettings: UpdatePreferenceDto }>
  > {
    return [
      {
        notificationType: 'payroll',
        defaultSettings: {
          preferredChannel: NotificationChannel.BOTH,
          isEnabled: true,
          emailEnabled: true,
          inAppEnabled: true,
        },
      },
      {
        notificationType: 'leave_request',
        defaultSettings: {
          preferredChannel: NotificationChannel.BOTH,
          isEnabled: true,
          emailEnabled: true,
          inAppEnabled: true,
        },
      },
      {
        notificationType: 'shoutout',
        defaultSettings: {
          preferredChannel: NotificationChannel.IN_APP,
          isEnabled: true,
          emailEnabled: false,
          inAppEnabled: true,
        },
      },
      {
        notificationType: 'system_announcement',
        defaultSettings: {
          preferredChannel: NotificationChannel.BOTH,
          isEnabled: true,
          emailEnabled: true,
          inAppEnabled: true,
        },
      },
      {
        notificationType: 'task_assignment',
        defaultSettings: {
          preferredChannel: NotificationChannel.IN_APP,
          isEnabled: true,
          emailEnabled: false,
          inAppEnabled: true,
        },
      },
      {
        notificationType: 'meeting_reminder',
        defaultSettings: {
          preferredChannel: NotificationChannel.BOTH,
          isEnabled: true,
          emailEnabled: true,
          inAppEnabled: true,
        },
      },
    ];
  }
  async shouldSendNotification(
    tenantMemberId: string,
    notificationType: NotificationPreferenceType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const preference = await this.getPreference(
      tenantMemberId,
      notificationType,
    );
    if (!preference) {
      return true;
    }
    if (!preference.isEnabled) {
      return false;
    }
    if (this.isInQuietHours(preference)) {
      return false;
    }
    switch (channel) {
      case NotificationChannel.EMAIL:
        return preference.emailEnabled;
      case NotificationChannel.IN_APP:
        return preference.inAppEnabled;
      case NotificationChannel.BOTH:
        return preference.emailEnabled || preference.inAppEnabled;
      default:
        return true;
    }
  }
  private isInQuietHours(preference: NotificationPreference): boolean {
    if (!preference.quietHoursStart || !preference.quietHoursEnd) {
      return false;
    }
    const now = new Date();
    const currentDay = now
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase();
    if (preference.quietDays && preference.quietDays.includes(currentDay)) {
      return true;
    }
    const currentTime = now.toTimeString().slice(0, 5); 
    const startTime = preference.quietHoursStart;
    const endTime = preference.quietHoursEnd;
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }
}
