import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { TenantMemberCreatedEvent } from '../../leave/events/leave.events';
import { MemberPointsService } from '../services/member-points.service';

@Injectable()
export class ShoutoutMemberListener {
  private readonly logger = new Logger(ShoutoutMemberListener.name);

  constructor(private readonly memberPointsService: MemberPointsService) {}

  @OnEvent('tenant.member.created')
  async handleTenantMemberCreated(event: TenantMemberCreatedEvent): Promise<void> {
    try {
      await this.memberPointsService.ensureMemberRow(event.tenantId, event.memberId);
    } catch (error) {
      this.logger.warn(
        `Failed to initialize shoutout points for member ${event.memberId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
