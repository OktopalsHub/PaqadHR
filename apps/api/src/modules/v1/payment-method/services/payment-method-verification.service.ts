import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../entities/payment-method.entity';

/**
 * Handles payment method verification.
 */
@Injectable()
export class PaymentMethodVerificationService {
  private readonly logger = new Logger(PaymentMethodVerificationService.name);

  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
  ) {}

  async initiateVerification(paymentMethodId: string) {
    // TODO: Extract from payment-method.service.ts
    throw new Error('Not implemented');
  }

  async completeVerification(paymentMethodId: string, verificationCode: string) {
    // TODO: Extract from payment-method.service.ts
  }

  async getVerificationStatus(paymentMethodId: string) {
    // TODO: Extract from payment-method.service.ts
    return { verified: false, status: 'pending' };
  }
}
