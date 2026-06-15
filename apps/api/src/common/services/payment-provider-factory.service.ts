import { Injectable } from '@nestjs/common';
import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import type { PaymentResult } from '../interfaces/payment-result.interface';
import { NombaProvider } from '../providers/nomba.provider';

@Injectable()
export class PaymentProviderFactoryService {
  constructor(private readonly nombaProvider: NombaProvider) {}

  async createPayment(data: CreatePaymentData): Promise<PaymentResult> {
    return this.nombaProvider.createPayment(data);
  }

  getFiatProvider() {
    return this.nombaProvider;
  }
}
