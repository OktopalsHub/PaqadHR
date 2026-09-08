import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isBachsConfigured } from 'src/common/config/bachs.config';
import { isPolarConfigured } from 'src/common/config/polar.config';
import { IsNull, Repository } from 'typeorm';
import { PlanPrice } from '../../plans/entities/plan-price.entity';
import {
  getBillingGlobalProvider,
  getBillingNgProvider,
} from '../config/billing-provider-resolver';
import { BillingProvider } from '../constants/billing-provider.enum';
import { BachsProductSyncService } from './bachs-product-sync.service';
import { PolarProductSyncService } from './polar-product-sync.service';

@Injectable()
export class BillingProductSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BillingProductSyncService.name);

  constructor(
    @InjectRepository(PlanPrice)
    private readonly priceRepo: Repository<PlanPrice>,
    private readonly bachsSync: BachsProductSyncService,
    private readonly polarSync: PolarProductSyncService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.warnMissingProductIds();
  }

  async warnMissingProductIds(): Promise<void> {
    const preferred = new Set([getBillingNgProvider(), getBillingGlobalProvider()]);

    if (preferred.has(BillingProvider.BACHS) && isBachsConfigured()) {
      const missingNgn = await this.priceRepo.count({
        where: { currency: 'NGN', bachsProductId: IsNull(), isActive: true },
      });
      const missingUsd = await this.priceRepo.count({
        where: { currency: 'USD', bachsProductId: IsNull(), isActive: true },
      });

      if (getBillingNgProvider() === BillingProvider.BACHS && missingNgn > 0) {
        this.logger.error(
          `${missingNgn} active NGN plan_prices row(s) missing bachs_product_id while BILLING_NG_PROVIDER=bachs. Run: pnpm --filter api sync:bachs-products`,
        );
      } else if (missingNgn > 0) {
        this.logger.warn(
          `${missingNgn} active NGN plan_prices row(s) missing bachs_product_id. Run: pnpm --filter api sync:bachs-products`,
        );
      }

      if (missingUsd > 0) {
        this.logger.warn(
          `${missingUsd} active USD plan_prices row(s) missing bachs_product_id. Run: pnpm --filter api sync:bachs-products`,
        );
      }
    }

    if (preferred.has(BillingProvider.POLAR) && isPolarConfigured()) {
      const missing = await this.priceRepo.count({
        where: {
          countryCode: 'GLOBAL',
          currency: 'USD',
          polarProductId: IsNull(),
          isActive: true,
        },
      });
      if (missing > 0) {
        this.logger.warn(
          `${missing} GLOBAL/USD plan_prices row(s) missing polar_product_id. Run: pnpm --filter api sync:polar-products`,
        );
      }
    }
  }

  async syncBachsProducts(): Promise<{ updated: number }> {
    return this.bachsSync.syncBachsProducts();
  }

  async syncPolarProducts(): Promise<{ updated: number }> {
    return this.polarSync.syncPolarProducts();
  }

  async healMissingProductIds(): Promise<{ bachsUpdated: number; polarUpdated: number }> {
    let bachsUpdated = 0;
    let polarUpdated = 0;

    if (isBachsConfigured()) {
      const missing = await this.priceRepo.count({
        where: [
          { currency: 'NGN', bachsProductId: IsNull(), isActive: true },
          { currency: 'USD', bachsProductId: IsNull(), isActive: true },
        ],
      });
      if (missing > 0) {
        bachsUpdated = (await this.bachsSync.syncBachsProducts()).updated;
      }
    }

    if (isPolarConfigured()) {
      const missing = await this.priceRepo.count({
        where: {
          countryCode: 'GLOBAL',
          currency: 'USD',
          polarProductId: IsNull(),
          isActive: true,
        },
      });
      if (missing > 0) {
        polarUpdated = (await this.polarSync.syncPolarProducts()).updated;
      }
    }

    return { bachsUpdated, polarUpdated };
  }
}
