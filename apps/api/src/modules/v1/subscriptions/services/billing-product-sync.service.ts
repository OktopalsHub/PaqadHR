import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isBachsConfigured } from 'src/common/config/bachs.config';
import { IsNull, Repository } from 'typeorm';
import { PlanPrice } from '../../plans/entities/plan-price.entity';
import {
  getBillingGlobalProvider,
  getBillingNgProvider,
} from '../config/billing-provider-resolver';
import { BillingProvider } from '../constants/billing-provider.enum';
import { BachsProductSyncService } from './bachs-product-sync.service';

@Injectable()
export class BillingProductSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BillingProductSyncService.name);

  constructor(
    @InjectRepository(PlanPrice)
    private readonly priceRepo: Repository<PlanPrice>,
    private readonly bachsSync: BachsProductSyncService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const shouldHeal = await this.warnMissingProductIds();
    if (!shouldHeal) {
      return;
    }

    // bachs_product_id is data stored on plan_prices — setting BILLING_*_PROVIDER=bachs
    // and BACHS_SECRET_KEY only turns the check on. plan_prices are (re)seeded without it
    // on every boot, so heal in the background using this process's credentials instead
    // of forcing a manual `sync:bachs-products` run on each deploy.
    void this.healMissingProductIds()
      .then(({ bachsUpdated }) => {
        if (bachsUpdated > 0) {
          this.logger.log(`Auto-synced ${bachsUpdated} Bachs product id(s) on startup`);
        }
      })
      .catch((error: Error) => {
        this.logger.error(`Bachs product auto-sync failed: ${error.message}`);
      });
  }

  /** Warns about active plan_prices missing Bachs product IDs; true when a heal should run. */
  async warnMissingProductIds(): Promise<boolean> {
    const preferred = new Set([getBillingNgProvider(), getBillingGlobalProvider()]);

    if (!preferred.has(BillingProvider.BACHS) || !isBachsConfigured()) {
      return false;
    }

    const missingNgn = await this.priceRepo.count({
      where: { currency: 'NGN', bachsProductId: IsNull(), isActive: true },
    });
    const missingUsd = await this.priceRepo.count({
      where: { currency: 'USD', bachsProductId: IsNull(), isActive: true },
    });

    if (missingNgn > 0) {
      const message = `${missingNgn} active NGN plan_prices row(s) missing bachs_product_id. Run: pnpm --filter api sync:bachs-products`;
      if (getBillingNgProvider() === BillingProvider.BACHS) {
        this.logger.error(`${message} (BILLING_NG_PROVIDER=bachs; auto-syncing)`);
      } else {
        this.logger.warn(message);
      }
    }

    if (missingUsd > 0) {
      this.logger.warn(
        `${missingUsd} active USD plan_prices row(s) missing bachs_product_id. Run: pnpm --filter api sync:bachs-products`,
      );
    }

    return missingNgn > 0 || missingUsd > 0;
  }

  async syncBachsProducts(): Promise<{ updated: number }> {
    return this.bachsSync.syncBachsProducts();
  }

  async healMissingProductIds(): Promise<{ bachsUpdated: number }> {
    let bachsUpdated = 0;

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

    return { bachsUpdated };
  }
}
