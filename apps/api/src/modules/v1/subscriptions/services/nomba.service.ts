import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums';
import {
  CreateSubscriptionPayload,
  CreateSubscriptionResponse,
  IPaymentProvider,
} from 'src/common/interfaces';
@Injectable()
export class NombaService implements IPaymentProvider {
  private readonly logger = new Logger(NombaService.name);
  getProviderType(): PaymentProvider {
    return PaymentProvider.NOMBA;
  }
  async createSubscription(
    _planId: string,
    _data: CreateSubscriptionPayload,
  ): Promise<CreateSubscriptionResponse> {
    this.logger.warn('NombaService.createSubscription stub called');
    throw new NotImplementedException('Nomba provider is not configured');
  }
  async cancelSubscription(_subscriptionId: string): Promise<void> {
    throw new NotImplementedException('Nomba provider is not configured');
  }
  async getSubscription(_subscriptionId: string): Promise<null> {
    return null;
  }
  async updateSubscription(
    _subscriptionId: string,
    _updates: unknown,
  ): Promise<null> {
    return null;
  }
  async processWebhook(_payload: unknown, _signature: string): Promise<void> {
    this.logger.warn('NombaService.processWebhook stub called');
  }
}
