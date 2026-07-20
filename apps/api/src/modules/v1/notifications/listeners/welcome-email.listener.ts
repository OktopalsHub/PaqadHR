import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  marketingSubscribeUrl,
  tenantFrontendUrl,
} from '../../../../common/utils/tenant-frontend-url.util';
import { TenantCreatedEvent } from '../../leave/events/leave.events';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type { Tenant } from '../../tenants/entities/tenant.entity';
import { ZeptomailEmailService } from '../services/zeptomail-email.service';

@Injectable()
export class WelcomeEmailListener {
  private readonly logger = new Logger(WelcomeEmailListener.name);

  constructor(
    private readonly emailService: ZeptomailEmailService,
    private readonly tenantMembersService: TenantMembersService,
  ) {}

  @OnEvent('tenant.created')
  async handleTenantCreated(event: TenantCreatedEvent): Promise<void> {
    const tenant = event.tenantData as Tenant | undefined;
    if (!tenant?.slug || !tenant.name) return;

    try {
      const member = await this.tenantMembersService.getTenantMember(
        event.tenantMemberId,
        event.tenantId,
      );
      const email = member.user?.email;
      if (!email) return;

      const firstName =
        member.firstName?.trim() || member.preferredName?.trim() || member.user?.name?.trim();
      const workspaceUrl = tenantFrontendUrl(tenant.slug);

      await this.emailService.sendTemplateEmail(email, 'welcome', {
        firstName,
        email,
        tenantName: tenant.name,
        setupUrl: workspaceUrl,
        workspaceUrl,
        trialUrl: marketingSubscribeUrl(tenant.slug),
        docsUrl: workspaceUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to send workspace welcome email for tenant ${event.tenantId}: ${message}`,
      );
    }
  }
}
