import { Injectable } from '@nestjs/common';
import { NombaProvider } from '../providers/nomba.provider';
import { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import { PaymentResult } from '../interfaces/payment-result.interface';

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
