import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingProvider } from '../constants/billing-provider.enum';
import { BillingEvent } from '../entities/billing-event.entity';

@Injectable()
export class BillingEventStore {
  constructor(
    @InjectRepository(BillingEvent) private readonly billingEventRepo: Repository<BillingEvent>,
  ) {}

  async hasProcessedEvent(eventId: string, provider?: BillingProvider): Promise<boolean> {
    return provider
      ? this.billingEventRepo.exists({ where: { eventId, provider } })
      : this.billingEventRepo.exists({ where: { eventId } });
  }

  async recordBillingEvent(
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    provider: BillingProvider = BillingProvider.NOMBA,
  ): Promise<void> {
    if (await this.billingEventRepo.findOne({ where: { eventId, provider } })) return;
    await this.billingEventRepo.save(
      this.billingEventRepo.create({ eventId, provider, eventType, payload }),
    );
  }

  advanceBillingPeriod(anchor: Date) {
    const s = new Date(anchor);
    const e = new Date(s);
    e.setMonth(e.getMonth() + 1);
    return { periodStart: s, periodEnd: e };
  }
}
