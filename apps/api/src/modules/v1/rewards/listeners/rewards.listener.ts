import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TenantCreatedEvent } from '../../leave/events/leave.events';
import { RewardsService } from '../services/rewards.service';
import { TenantWalletService } from '../services/tenant-wallet.service';

@Injectable()
export class RewardsListener {
  private readonly logger = new Logger(RewardsListener.name);

  constructor(
    private readonly walletService: TenantWalletService,
    private readonly rewardsService: RewardsService,
  ) {}

  @OnEvent('tenant.created')
  async handleTenantCreated(event: TenantCreatedEvent) {
    try {
      await this.walletService.ensureWallet(event.tenantId);
    } catch (error) {
      this.logger.error(
        `Failed to initialize tenant wallet for tenant ${event.tenantId}: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @OnEvent('rewards.catalogCountriesChanged')
  async handleCatalogCountriesChanged(payload: { tenantId: string }) {
    try {
      await this.rewardsService.syncCatalog(payload.tenantId, { force: true });
    } catch (error) {
      this.logger.warn(
        `Gift catalog sync failed for tenant ${payload.tenantId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
