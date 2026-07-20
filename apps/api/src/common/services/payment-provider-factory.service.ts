import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentMethodType } from '../enums/payment-type.enum';
import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import type { PaymentResult } from '../interfaces/payment-result.interface';
import { NoahProvider } from '../providers/noah.provider';
import { NombaProvider } from '../providers/nomba.provider';
import {
  paymentProviderLabel,
  resolvePaymentProvider,
} from '../utils/resolve-payment-provider.util';

@Injectable()
export class PaymentProviderFactoryService {
  constructor(
    private readonly nombaProvider: NombaProvider,
    private readonly noahProvider: NoahProvider,
  ) {}

  resolveProvider(currency: string, paymentMethodType?: PaymentMethodType) {
    return resolvePaymentProvider(currency, paymentMethodType) === PaymentProvider.NOMBA
      ? this.nombaProvider
      : this.noahProvider;
  }

  resolveProviderName(currency: string, paymentMethodType?: PaymentMethodType): string {
    return paymentProviderLabel(resolvePaymentProvider(currency, paymentMethodType));
  }

  async createPayment(data: CreatePaymentData): Promise<PaymentResult> {
    return this.resolveProvider(data.currency).createPayment(data);
  }

  getFiatProvider(currency: string, paymentMethodType?: PaymentMethodType) {
    return this.resolveProvider(currency, paymentMethodType);
  }

  getNombaProvider() {
    return this.nombaProvider;
  }

  getNoahProvider() {
    return this.noahProvider;
  }
}
