import { Injectable, Logger } from '@nestjs/common';
import { PaymentMethodCrudService } from './payment-method-crud.service';
import { PaymentMethodPasscodeService } from './payment-method-passcode.service';
import { PaymentMethodVerificationService } from './payment-method-verification.service';
import { PaymentMethodReadinessService } from './payment-method-readiness.service';
import { PaymentMethodBankService } from './payment-method-bank.service';
import type { PaymentMethod } from '../entities/payment-method.entity';
import type { CreatePaymentMethodDto } from '../dto/create-payment-method.dto';
import type { UpdatePaymentMethodDto } from '../dto/update-payment-method.dto';
import type { ChangePasscodeDto } from '../dto/change-passcode.dto';

/**
 * Facade service that delegates to specialized payment method services.
 */
@Injectable()
export class PaymentMethodService {
  private readonly logger = new Logger(PaymentMethodService.name);

  constructor(
    private readonly crudService: PaymentMethodCrudService,
    private readonly passcodeService: PaymentMethodPasscodeService,
    private readonly verificationService: PaymentMethodVerificationService,
    private readonly readinessService: PaymentMethodReadinessService,
    private readonly bankService: PaymentMethodBankService,
  ) { }

  // ==================== CRUD Operations ====================

  async createPaymentMethod(
    dto: CreatePaymentMethodDto,
    tenantId: string,
    memberId: string,
    actorMemberId?: string,
  ): Promise<PaymentMethod> {
    return this.crudService.createPaymentMethod(dto, tenantId, memberId, actorMemberId);
  }

  async updatePaymentMethod(
    paymentMethodId: string,
    dto: UpdatePaymentMethodDto,
    tenantId: string,
    memberId: string,
  ): Promise<PaymentMethod> {
    return this.crudService.updatePaymentMethod(paymentMethodId, dto, tenantId, memberId);
  }

  async getPaymentMethods(
    tenantId: string,
    memberId: string,
    options?: { includeInactive?: boolean },
  ): Promise<PaymentMethod[]> {
    return this.crudService.getPaymentMethods(tenantId, memberId, options);
  }

  async getPrimaryPaymentMethod(
    tenantId: string,
    memberId: string,
  ): Promise<PaymentMethod | null> {
    return this.crudService.getPrimaryPaymentMethod(tenantId, memberId);
  }

  async deletePaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    actorMemberId?: string,
  ): Promise<void> {
    return this.crudService.deletePaymentMethod(paymentMethodId, tenantId, memberId, actorMemberId);
  }

  async findByMemberId(memberId: string): Promise<PaymentMethod | null> {
    return this.crudService.findByMemberId(memberId);
  }

  async findById(id: string): Promise<PaymentMethod | null> {
    return this.crudService.findById(id);
  }

  async findByIdForMember(
    id: string,
    memberId: string,
    requesterRole: string,
  ): Promise<PaymentMethod | null> {
    return this.crudService.findByIdForMember(id, memberId, requesterRole);
  }

  async findByMemberIdForRequester(
    memberId: string,
    requesterRole: string,
    requesterId?: string,
  ): Promise<PaymentMethod[]> {
    return this.crudService.findByMemberIdForRequester(memberId, requesterRole, requesterId);
  }

  async getAllowedCurrencies(tenantId: string): Promise<string[]> {
    return this.crudService.getAllowedCurrencies(tenantId);
  }

  // ==================== Passcode Operations ====================

  async changePasscode(
    paymentMethodId: string,
    dto: ChangePasscodeDto,
    tenantId: string,
    memberId: string,
  ): Promise<void> {
    return this.passcodeService.changePasscode(paymentMethodId, dto, tenantId, memberId);
  }

  async getPasscodeHistory(
    tenantId: string,
    paymentMethodId: string,
  ): Promise<Array<{ timestamp: Date; actorId: string }>> {
    return this.passcodeService.getPasscodeHistory(tenantId, paymentMethodId);
  }

  async verifyPasscode(
    paymentMethodId: string,
    passcode: string,
  ): Promise<{ isValid: boolean }> {
    return this.passcodeService.verifyPasscode(paymentMethodId, passcode);
  }

  // ==================== Verification Operations ====================

  async verifyPaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    verificationData?: any,
  ): Promise<PaymentMethod> {
    return this.verificationService.verifyPaymentMethod(
      paymentMethodId,
      tenantId,
      memberId,
      verificationData,
    );
  }

  async listPendingVerificationForTenant(
    tenantId: string,
  ): Promise<PaymentMethod[]> {
    return this.verificationService.listPendingVerificationForTenant(tenantId);
  }

  async recordPaymentMethodUsage(paymentMethodId: string): Promise<void> {
    return this.verificationService.recordPaymentMethodUsage(paymentMethodId);
  }

  // ==================== Readiness Operations ====================

  async assessPayrollReadiness(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    runIsCrypto = false,
  ): Promise<{ ready: boolean; issues: any[]; message: string }> {
    return this.readinessService.assessPayrollReadiness(
      paymentMethodId,
      tenantId,
      memberId,
      runIsCrypto,
    );
  }

  async resolvePayrollPaymentMethod(
    memberId: string,
    currency: string,
    tenantId: string,
  ): Promise<PaymentMethod | null> {
    return this.readinessService.resolvePayrollPaymentMethod(memberId, currency, tenantId);
  }

  // ==================== Bank Operations ====================

  async listNigerianBanks(): Promise<Array<{ code: string; name: string }>> {
    return this.bankService.listNigerianBanks();
  }

  async lookupNigerianBankAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<{ accountName: string; bankCode: string; bankName: string }> {
    return this.bankService.lookupNigerianBankAccount(accountNumber, bankCode);
  }

  async listGlobalBanks(countryCode: string): Promise<Array<{ code: string; name: string }>> {
    return this.bankService.listGlobalBanks(countryCode);
  }

  async validateBankAccount(
    accountNumber: string,
    bankCode: string,
    countryCode: string,
  ): Promise<{ valid: boolean; accountName?: string }> {
    return this.bankService.validateBankAccount(accountNumber, bankCode, countryCode);
  }
}
