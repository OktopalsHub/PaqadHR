import { Injectable, Logger } from '@nestjs/common';
import {
  AuditAction,
  AuditSeverity,
  AuditStatus,
} from '../../../../common/enums/audit-action.enum';
import type { AuditLogsService } from '../../../../common/services/audit-logs.service';
import type { ShoutoutCreatedEventPayload } from '../events/shoutout.events';

@Injectable()
export class ShoutoutAuditService {
  private readonly logger = new Logger(ShoutoutAuditService.name);

  constructor(private readonly auditLogsService: AuditLogsService) {}

  async logShoutoutCreated(payload: ShoutoutCreatedEventPayload): Promise<void> {
    const description = `Shoutout created via ${payload.source} for ${payload.recipientIds.length} recipient(s), ${payload.totalPoints} total points`;

    await this.auditLogsService.queueAuditLog({
      action: AuditAction.SHOUTOUT_CREATED,
      resourceType: 'shoutout',
      resourceId: payload.shoutoutId,
      description,
      severity: AuditSeverity.LOW,
      status: AuditStatus.SUCCESS,
      tenantId: payload.tenantId,
      userId: payload.senderMemberId,
      metadata: {
        recipientIds: payload.recipientIds,
        totalPoints: payload.totalPoints,
        pointsPerRecipient: payload.pointsPerRecipient,
        categoryNames: payload.categoryNames,
        source: payload.source,
        messagePreview: payload.message.slice(0, 200),
      },
    });

    this.logger.log(`Audit queued: shoutout ${payload.shoutoutId} by ${payload.senderMemberId}`);
  }
}
