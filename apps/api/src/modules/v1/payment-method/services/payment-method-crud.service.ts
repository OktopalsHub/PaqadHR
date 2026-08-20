import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../entities/payment-method.entity';

/**
 * Handles Create, Update, Delete operations for payment methods.
 */
@Injectable()
export class PaymentMethodCrudService {
  private readonly logger = new Logger(PaymentMethodCrudService.name);

  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
  ) {}

  async createPaymentMethod(tenantId: string, methodData: any) {
    // TODO: Extract from payment-method.service.ts
    throw new Error('Not implemented');
  }

  async updatePaymentMethod(paymentMethodId: string, updates: any) {
    // TODO: Extract from payment-method.service.ts
  }

  async deletePaymentMethod(paymentMethodId: string) {
    // TODO: Extract from payment-method.service.ts
  }

  async getPaymentMethod(paymentMethodId: string) {
    // TODO: Extract from payment-method.service.ts
    return null;
  }

  async listPaymentMethods(tenantId: string) {
    // TODO: Extract from payment-method.service.ts
    return [];
  }
}
