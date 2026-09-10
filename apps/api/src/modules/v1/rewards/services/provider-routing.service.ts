import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { Repository } from 'typeorm';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { resolveRewardsWalletPaymentProvider } from '../config/rewards-wallet-provider.config';

@Injectable()
export class ProviderRoutingService {
  constructor(
    private readonly tenantSettingsService: TenantSettingsService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  resolvePaymentProvider(tenantId: string, currency: string): Promise<PaymentProvider> {
    return this.tenantRepository
      .findOne({ where: { id: tenantId } })
      .then((tenant) => resolveRewardsWalletPaymentProvider(tenant?.countryCode, currency));
  }

  async resolveBillingEmail(tenantId: string): Promise<string | null> {
    try {
      const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const contactEmail = settings.settings.billing?.contactEmail?.trim();
      if (contactEmail) return contactEmail;
    } catch {}
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      relations: ['createdBy'],
    });
    return tenant?.createdBy?.email?.trim() ?? null;
  }
}
