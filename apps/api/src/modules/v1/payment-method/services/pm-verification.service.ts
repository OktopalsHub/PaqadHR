import { Injectable } from '@nestjs/common';
import type { SubmitForVerificationDto, VerifyPaymentMethodDto } from '../dto/payment-method.dto';
import { PaymentMethodVerificationService } from './payment-method-verification.service';

@Injectable()
export class PmVerificationService {
  constructor(private readonly verificationService: PaymentMethodVerificationService) {}

  async submitForVerification(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    userId: string,
    dto: SubmitForVerificationDto,
  ) {
    return this.verificationService.submitForVerification(
      paymentMethodId,
      tenantId,
      memberId,
      userId,
      dto,
    );
  }

  async verifyPaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    dto: VerifyPaymentMethodDto,
    verifierMemberId: string,
  ) {
    return this.verificationService.verifyPaymentMethod(
      paymentMethodId,
      tenantId,
      dto,
      verifierMemberId,
    );
  }

  async listPendingVerificationForTenant(tenantId: string, excludeMemberId?: string) {
    return this.verificationService.listPendingVerificationForTenant(tenantId, excludeMemberId);
  }
}
