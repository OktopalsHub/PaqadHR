import { Injectable, Logger } from '@nestjs/common';

/**
 * Handles payroll readiness assessment.
 */
@Injectable()
export class PaymentMethodReadinessService {
  private readonly logger = new Logger(PaymentMethodReadinessService.name);

  async checkPayrollReadiness(paymentMethodId: string) {
    // TODO: Extract from payment-method.service.ts
    return { ready: false, issues: [] };
  }

  async getPaymentMethodReadiness(paymentMethodId: string) {
    // TODO: Extract from payment-method.service.ts
    return { status: 'pending', requirements: [] };
  }
}
