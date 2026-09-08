import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import { NotificationPriority } from '../../../../common/enums/notification-priority.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { NotificationService } from './notification.service';

@Injectable()
export class MemberNotificationsService {
  constructor(private readonly notificationService: NotificationService) {}

  async sendWelcomeNotification(
    recipientId: string,
    tenantId: string,
    variables: { name: string; tenantName: string; ctaUrl?: string },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.MEDIUM,
      title: `Welcome to ${variables.tenantName}!`,
      message: `Hi ${variables.name}, welcome to ${variables.tenantName}. We're glad you're here.`,
      recipientId,
      tenantId,
      actionData: variables.ctaUrl
        ? { url: variables.ctaUrl, buttonText: 'Get Started', actionType: 'navigate' }
        : undefined,
    });
  }

  async sendInvitationNotification(
    email: string,
    variables: { inviterName: string; tenantName: string; inviteLink: string },
  ): Promise<void> {
    // Invitations are sent via email only, no in-app bell.
  }

  async sendNewTeamMemberNotification(
    tenantId: string,
    variables: {
      newMemberName: string;
      department?: string;
      role?: string;
    },
  ): Promise<void> {
    const departmentText = variables.department ? ` in ${variables.department}` : '';
    const roleText = variables.role ? ` as ${variables.role}` : '';

    await this.notificationService.sendTenantNotification(
      tenantId,
      'New team member',
      `${variables.newMemberName} has joined${departmentText}${roleText}. Say hello!`,
      NotificationChannel.IN_APP,
      {
        type: 'new_team_member',
        newMemberName: variables.newMemberName,
        department: variables.department,
        role: variables.role,
      },
    );
  }

  async sendBirthdayNotification(
    tenantId: string,
    variables: {
      birthdayPersonName: string;
      birthdayPersonId: string;
    },
  ): Promise<void> {
    await this.notificationService.sendTenantNotification(
      tenantId,
      'Birthday today!',
      `It's ${variables.birthdayPersonName}'s birthday today! Don't forget to wish them well.`,
      NotificationChannel.IN_APP,
      {
        type: 'birthday',
        birthdayPersonName: variables.birthdayPersonName,
        birthdayPersonId: variables.birthdayPersonId,
      },
    );
  }

  async sendProfileUpdatedNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      updatedFields: string[];
      updatedBy: string;
    },
  ): Promise<void> {
    const fields = variables.updatedFields.join(', ');
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.BOTH,
      priority: NotificationPriority.LOW,
      title: 'Profile updated',
      message: `Your profile was updated by ${variables.updatedBy}. Fields changed: ${fields}`,
      recipientId,
      tenantId,
      metadata: {
        type: 'profile_updated',
        updatedFields: variables.updatedFields,
        updatedBy: variables.updatedBy,
      },
    });
  }

  async sendInvitationDeclinedNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      inviteeEmail: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.LOW,
      title: 'Invitation declined',
      message: `${variables.inviteeEmail} declined the invitation to join the workspace.`,
      recipientId,
      tenantId,
      metadata: {
        type: 'invitation_declined',
        inviteeEmail: variables.inviteeEmail,
      },
    });
  }

  async sendAttendanceExceptionNotification(
    recipientId: string,
    tenantId: string,
    variables: {
      status: 'approved' | 'rejected';
      exceptionType: string;
      date: string;
      reviewerName?: string;
      comments?: string;
    },
  ): Promise<void> {
    await this.notificationService.createNotification({
      type: NotificationType.USER,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.LOW,
      title: `Attendance exception ${variables.status}`,
      message: `Your ${variables.exceptionType.toLowerCase()} exception for ${variables.date} was ${variables.status}.${variables.comments ? ` Comment: ${variables.comments}` : ''}`,
      recipientId,
      tenantId,
      metadata: {
        type: 'attendance_exception',
        status: variables.status,
        exceptionType: variables.exceptionType,
        date: variables.date,
        reviewerName: variables.reviewerName ?? null,
        comments: variables.comments ?? null,
      },
    });
  }
}
