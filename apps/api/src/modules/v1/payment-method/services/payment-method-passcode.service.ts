import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../entities/payment-method.entity';

/**
 * Handles passcode management and history.
 */
@Injectable()
export class PaymentMethodPasscodeService {
  private readonly logger = new Logger(PaymentMethodPasscodeService.name);

  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
  ) {}

  async setPasscode(paymentMethodId: string, passcode: string) {
    // TODO: Extract from payment-method.service.ts
    throw new Error('Not implemented');
  }

  async verifyPasscode(paymentMethodId: string, passcode: string) {
    // TODO: Extract from payment-method.service.ts
    throw new Error('Not implemented');
  }

  async getPasscodeHistory(paymentMethodId: string) {
    // TODO: Extract from payment-method.service.ts
    return [];
  }
}
