import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { TenantCreatedEvent } from '../../leave/events/leave.events';
import { TenantsService } from '../../tenants/tenants.service';
import { resolveRewardsWalletVirtualAccountProvider } from '../config/rewards-wallet-provider.config';
import { RewardsService } from '../services/rewards.service';
import { TenantWalletService } from '../services/tenant-wallet.service';
import { TenantWalletVirtualAccountService } from '../services/tenant-wallet-virtual-account.service';

@Injectable()
export class RewardsListener {
  private readonly logger = new Logger(RewardsListener.name);

  constructor(
    private readonly walletService: TenantWalletService,
    private readonly rewardsService: RewardsService,
    private readonly walletVirtualAccountService: TenantWalletVirtualAccountService,
    private readonly tenantsService: TenantsService,
  ) {}

  @OnEvent('tenant.created')
  async handleTenantCreated(event: TenantCreatedEvent) {
    try {
      const wallet = await this.walletService.ensureWallet(event.tenantId);
      const tenant = await this.tenantsService.getTenant(event.tenantId);
      const country = (tenant.countryCode || tenant.preferredCurrency || 'NGN').toUpperCase();
      const provider = resolveRewardsWalletVirtualAccountProvider(wallet.currencyCode);

      if (
        country === 'NG' &&
        wallet.currencyCode.toUpperCase() === 'NGN' &&
        provider === PaymentProvider.NOMBA
      ) {
        try {
          await this.walletVirtualAccountService.provisionVirtualAccount(event.tenantId);
        } catch (error) {
          this.logger.warn(
            `Auto virtual-account provision skipped for tenant ${event.tenantId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
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
      await this.rewardsService.syncReloadlyProducts(payload.tenantId, { force: true });
    } catch (error) {
      this.logger.warn(
        `Reloadly catalog sync failed for tenant ${payload.tenantId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
