import {
  BadRequestException,
  Injectable,
  Logger,
  NotImplementedException,
} from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums';
import {
  CreateSubscriptionPayload,
  CreateSubscriptionResponse,
  IPaymentProvider,
} from 'src/common/interfaces';
import { isBillingGatewayEnabled } from '../config/billing.config';

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
    this.logger.warn('NombaService.createSubscription blocked — gateway disabled');
    if (!isBillingGatewayEnabled()) {
      throw new BadRequestException(
        'Card billing is disabled. Tenants start on trial; use admin activation for paid access.',
      );
    }
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
