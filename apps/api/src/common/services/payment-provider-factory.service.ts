import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentMethodType } from '../enums/payment-type.enum';
import { MonnifyProvider } from '../providers/monnify.provider';
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
    private readonly monnifyProvider: MonnifyProvider,
    private readonly noahProvider: NoahProvider,
  ) {}

  resolveProvider(currency: string, paymentMethodType?: PaymentMethodType) {
    const provider = resolvePaymentProvider(currency, paymentMethodType);
    if (provider === PaymentProvider.MONNIFY) {
      return this.monnifyProvider;
    }
    if (provider === PaymentProvider.NOMBA) {
      return this.nombaProvider;
    }
    return this.noahProvider;
  }

  resolveProviderName(currency: string, paymentMethodType?: PaymentMethodType): string {
    return paymentProviderLabel(resolvePaymentProvider(currency, paymentMethodType));
  }

  async createPayment(data: Parameters<NombaProvider['createPayment']>[0]) {
    return this.resolveProvider(data.currency).createPayment(data);
  }

  getFiatProvider(currency: string, paymentMethodType?: PaymentMethodType) {
    return this.resolveProvider(currency, paymentMethodType);
  }

  getNombaProvider() {
    return this.nombaProvider;
  }

  getMonnifyProvider() {
    return this.monnifyProvider;
  }

  getNoahProvider() {
    return this.noahProvider;
  }
}
