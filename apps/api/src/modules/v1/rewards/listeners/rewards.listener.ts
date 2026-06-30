import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TenantCreatedEvent } from '../../leave/events/leave.events';
import { TenantWalletService } from '../services/tenant-wallet.service';

@Injectable()
export class RewardsListener {
  private readonly logger = new Logger(RewardsListener.name);

  constructor(private readonly walletService: TenantWalletService) {}

  @OnEvent('tenant.created')
  async handleTenantCreated(event: TenantCreatedEvent) {
    try {
      this.logger.log(`Initializing tenant wallet for tenant: ${event.tenantId}`);
      await this.walletService.ensureWallet(event.tenantId);
      this.logger.log(`Successfully initialized tenant wallet for tenant: ${event.tenantId}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize tenant wallet for tenant ${event.tenantId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
