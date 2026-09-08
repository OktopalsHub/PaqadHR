import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isCryptoCurrency } from 'src/common/constants/crypto-currencies.constant';
import { getSupportedPaymentCurrencies } from 'src/common/constants/supported-payment-currencies.constant';
import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import { PaymentMethodType } from 'src/common/enums/payment-type.enum';
import type {
  PayrollPaymentIssue,
  PayrollPaymentReadiness,
} from 'src/common/interfaces/payroll-payment-readiness.interface';
import { EncryptionService } from 'src/common/services/encryption.service';
import { In, Repository } from 'typeorm';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import { PaymentMethod } from '../entities/payment-method.entity';
import { requiresGlobalInstitutionCode } from '../utils/global-bank-validation.util';
import { PaymentSecurityService } from './payment-security.service';

@Injectable()
export class PayrollReadinessService {
  constructor(
    @InjectRepository(PaymentMethod) private readonly paymentMethodRepo: Repository<PaymentMethod>,
    @InjectRepository(TenantMember) private readonly tenantMemberRepo: Repository<TenantMember>,
    private readonly paymentSecurityService: PaymentSecurityService,
    private readonly tenantConfigService: TenantConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  private decryptField(value?: string | null): string | null | undefined {
    if (!value?.trim()) return value;
    if (!this.encryptionService.isEncrypted(value)) return value;
    return this.encryptionService.decrypt(value);
  }

  private withDecrypted(method: PaymentMethod | null): PaymentMethod | null {
    if (!method) return null;
    const decrypted = Object.assign(Object.create(Object.getPrototypeOf(method)), method);
    decrypted.accountNumber = this.decryptField(method.accountNumber) ?? null;
    decrypted.accountName = this.decryptField(method.accountName) ?? null;
    return decrypted;
  }

  async assessPayrollReadiness(
    tenantId: string,
    memberId: string,
    currency: string,
    excludedFromRun = false,
  ): Promise<PayrollPaymentReadiness> {
    const results = await this.assessBulkPayrollReadiness(
      tenantId,
      [memberId],
      currency,
      excludedFromRun ? [memberId] : [],
    );
    return results[0];
  }

  async assessBulkPayrollReadiness(
    tenantId: string,
    memberIds: string[],
    currency: string,
    excludedMemberIds: string[] = [],
  ): Promise<PayrollPaymentReadiness[]> {
    const normalizedCurrency = currency.toUpperCase();
    const runIsCrypto = isCryptoCurrency(normalizedCurrency);
    const excludedSet = new Set(excludedMemberIds);

    const paymentMethods = await this.paymentMethodRepo.find({
      where: { tenantId, memberId: In(memberIds), currency: normalizedCurrency },
      order: { status: 'DESC', isPrimary: 'DESC', updatedAt: 'DESC' },
    });
    const lockedMembers = await this.paymentSecurityService.getLockedMemberIds(tenantId, memberIds);

    const methodMap = new Map<string, PaymentMethod>();
    for (const method of paymentMethods) {
      if (!methodMap.has(method.memberId)) {
        const decrypted = this.withDecrypted(method);
        if (decrypted) methodMap.set(method.memberId, decrypted);
      }
    }

    const employeeSettings = await this.tenantConfigService.requireIdentityForPayroll(tenantId);
    let members: { id: string; identityBvn?: string; identityNin?: string }[] = [];
    if (employeeSettings) {
      const tm = await this.tenantMemberRepo.find({
        where: { id: In(memberIds), tenantId },
        select: ['id', 'identityBvn', 'identityNin'],
      });
      members = tm.map((m) => ({
        id: m.id,
        identityBvn: m.identityBvn ?? undefined,
        identityNin: m.identityNin ?? undefined,
      }));
    }
    const memberMap = new Map(members.map((m) => [m.id, m]));

    const results: PayrollPaymentReadiness[] = [];
    for (const memberId of memberIds) {
      if (excludedSet.has(memberId)) {
        results.push({
          memberId,
          ready: false,
          issues: ['EXCLUDED_FROM_RUN' as PayrollPaymentIssue],
          message: 'Employee was removed from this payroll run and will not be paid.',
        });
        continue;
      }
      const method = methodMap.get(memberId);
      if (!method) {
        results.push({
          memberId,
          ready: false,
          issues: ['MISSING_PAYMENT_METHOD' as PayrollPaymentIssue],
          message: runIsCrypto
            ? `Add a verified ${normalizedCurrency} crypto wallet in payment settings.`
            : `Add a verified ${normalizedCurrency} bank account in payment settings.`,
          currency: normalizedCurrency,
        });
        continue;
      }

      const issues: PayrollPaymentIssue[] = [];
      if (method.currency?.toUpperCase() !== normalizedCurrency)
        issues.push('CURRENCY_MISMATCH' as PayrollPaymentIssue);
      const methodIsCrypto = method.type === PaymentMethodType.CRYPTO;
      if (runIsCrypto !== methodIsCrypto)
        issues.push('PAYMENT_RAIL_MISMATCH' as PayrollPaymentIssue);
      if (!method.isVerified) issues.push('UNVERIFIED_PAYMENT_METHOD' as PayrollPaymentIssue);
      if (lockedMembers.has(memberId)) issues.push('LOCKED_PAYMENT_METHOD' as PayrollPaymentIssue);

      if (runIsCrypto || methodIsCrypto) {
        const wallet =
          (method.metadata?.walletAddress as string | undefined) ?? method.accountNumber;
        if (!wallet?.trim()) issues.push('INCOMPLETE_WALLET_DETAILS' as PayrollPaymentIssue);
      } else {
        if (
          !method.accountNumber?.trim() ||
          !method.accountName?.trim() ||
          !method.bankName?.trim()
        )
          issues.push('INCOMPLETE_BANK_DETAILS' as PayrollPaymentIssue);
        if (normalizedCurrency === 'NGN' && !method.bankCode?.trim())
          issues.push('INCOMPLETE_BANK_DETAILS' as PayrollPaymentIssue);
        if (requiresGlobalInstitutionCode(normalizedCurrency) && !method.bankCode?.trim())
          issues.push('INCOMPLETE_BANK_DETAILS' as PayrollPaymentIssue);
        if (normalizedCurrency !== 'NGN' && !method.country?.trim())
          issues.push('INCOMPLETE_BANK_DETAILS' as PayrollPaymentIssue);
      }
      if (!getSupportedPaymentCurrencies().includes(normalizedCurrency))
        issues.push('UNSUPPORTED_CURRENCY' as PayrollPaymentIssue);
      if (employeeSettings) {
        const member = memberMap.get(memberId);
        if (!member?.identityBvn?.trim() && !member?.identityNin?.trim())
          issues.push('MISSING_IDENTITY' as PayrollPaymentIssue);
      }

      const ready = issues.length === 0 && method.isVerified && !lockedMembers.has(memberId);
      results.push({
        memberId,
        ready,
        issues,
        message: ready
          ? 'Ready for payroll disbursement.'
          : this.buildReadinessMessage(issues, runIsCrypto, method.status),
        paymentMethodId: method.id,
        currency: method.currency ?? normalizedCurrency,
      });
    }
    return results;
  }

  async resolvePayrollPaymentMethod(
    tenantId: string,
    memberId: string,
    currency: string,
  ): Promise<PaymentMethod | null> {
    const normalizedCurrency = currency.toUpperCase();
    const primary = await this.paymentMethodRepo.findOne({
      where: {
        tenantId,
        memberId,
        currency: normalizedCurrency,
        isPrimary: true,
        status: PaymentMethodStatus.VERIFIED,
      },
    });
    if (primary) return this.withDecrypted(primary);
    const verified = await this.paymentMethodRepo.findOne({
      where: {
        tenantId,
        memberId,
        currency: normalizedCurrency,
        status: PaymentMethodStatus.VERIFIED,
      },
      order: { isPrimary: 'DESC', updatedAt: 'DESC' },
    });
    if (verified) return this.withDecrypted(verified);
    const fallback = await this.paymentMethodRepo.findOne({
      where: { tenantId, memberId, currency: normalizedCurrency },
      order: { isPrimary: 'DESC', updatedAt: 'DESC' },
    });
    return this.withDecrypted(fallback);
  }

  private buildReadinessMessage(
    issues: PayrollPaymentIssue[],
    runIsCrypto = false,
    methodStatus?: PaymentMethodStatus,
  ): string {
    if (issues.includes('MISSING_PAYMENT_METHOD' as PayrollPaymentIssue))
      return runIsCrypto
        ? 'Payment settings are not set up yet. Add a crypto wallet.'
        : 'Payment settings are not set up yet. Add a bank account.';
    if (issues.includes('PAYMENT_RAIL_MISMATCH' as PayrollPaymentIssue))
      return runIsCrypto
        ? 'This run pays in crypto. Add a matching crypto wallet.'
        : 'This run pays to bank accounts. Add a matching bank account.';
    if (issues.includes('UNVERIFIED_PAYMENT_METHOD' as PayrollPaymentIssue)) {
      if (methodStatus === PaymentMethodStatus.DRAFT) return 'Payment account is in draft.';
      if (methodStatus === PaymentMethodStatus.REJECTED)
        return 'Payment details were rejected. Update and resubmit.';
      return 'Payment details are pending verification.';
    }
    if (issues.includes('LOCKED_PAYMENT_METHOD' as PayrollPaymentIssue))
      return 'Payment settings are temporarily locked. Ask the employee to unlock.';
    if (issues.includes('INCOMPLETE_WALLET_DETAILS' as PayrollPaymentIssue))
      return 'Crypto wallet address is missing.';
    if (issues.includes('INCOMPLETE_BANK_DETAILS' as PayrollPaymentIssue))
      return 'Bank account details are incomplete.';
    if (issues.includes('CURRENCY_MISMATCH' as PayrollPaymentIssue))
      return 'No verified payment method matches this payroll currency.';
    if (issues.includes('UNSUPPORTED_CURRENCY' as PayrollPaymentIssue))
      return 'This payroll currency is not supported for automated payouts.';
    if (issues.includes('MISSING_IDENTITY' as PayrollPaymentIssue))
      return 'BVN or NIN is required on this employee profile before payroll.';
    return 'Employee is not ready to receive payroll.';
  }
}
