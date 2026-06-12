import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditAction,
  AuditSeverity,
  AuditStatus,
} from '../../../../common/enums/audit-action.enum';
import { AuditLog } from '../entities/audit-log.entity';
import { ShoutoutCreatedEventPayload } from '../events/shoutout.events';

@Injectable()
export class ShoutoutAuditService {
  private readonly logger = new Logger(ShoutoutAuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async logShoutoutCreated(payload: ShoutoutCreatedEventPayload): Promise<void> {
    const description = `Shoutout created via ${payload.source} for ${payload.recipientIds.length} recipient(s), ${payload.totalPoints} total points`;

    const entry = this.auditLogRepository.create({
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

    await this.auditLogRepository.save(entry);
    this.logger.log(
      `Audit: shoutout ${payload.shoutoutId} created by ${payload.senderMemberId} in tenant ${payload.tenantId}`,
    );
  }
}
