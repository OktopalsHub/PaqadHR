import { Injectable } from '@nestjs/common';
import {
  AuditAction,
  AuditSeverity,
  AuditStatus,
} from '../../../../common/enums/audit-action.enum';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';
import type { ShoutoutCreatedEventPayload } from '../events/shoutout.events';

@Injectable()
export class ShoutoutAuditService {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  async logShoutoutCreated(payload: ShoutoutCreatedEventPayload): Promise<void> {
    const description = `Shoutout created for ${payload.recipientIds.length} recipient(s), ${payload.totalPoints} total points`;

    await this.auditLogsService.queueAuditLog({
      action: AuditAction.SHOUTOUT_CREATED,
      resourceType: 'shoutout',
      resourceId: payload.shoutoutId,
      description,
      severity: AuditSeverity.LOW,
      status: AuditStatus.SUCCESS,
      tenantId: payload.tenantId,
      userId: payload.senderUserId,
      metadata: {
        recipientIds: payload.recipientIds,
        recipients: payload.recipients,
        totalPoints: payload.totalPoints,
        categoryNames: payload.categoryNames,
        source: payload.source,
        messagePreview: payload.message.slice(0, 200),
      },
    });
  }
}
