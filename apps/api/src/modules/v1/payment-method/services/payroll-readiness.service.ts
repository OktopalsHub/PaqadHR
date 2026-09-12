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
import { In, Not, Repository } from 'typeorm';
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

  async findPrimaryPayoutMethod(tenantId: string, memberId: string): Promise<PaymentMethod | null> {
    const methods = await this.paymentMethodRepo.find({
      where: {
        tenantId,
        memberId,
        status: Not(PaymentMethodStatus.SUSPENDED),
      },
      order: { isPrimary: 'DESC', updatedAt: 'DESC', createdAt: 'DESC' },
    });
    const verified = methods.filter((method) => method.status === PaymentMethodStatus.VERIFIED);
    const primaryVerified = verified.find((method) => method.isPrimary);
    if (primaryVerified) return this.withDecrypted(primaryVerified);
    if (verified.length === 1) return this.withDecrypted(verified[0]);
    return null;
  }

  async assessPayrollReadiness(
    tenantId: string,
    memberId: string,
    excludedFromRun = false,
  ): Promise<PayrollPaymentReadiness> {
    const results = await this.assessBulkPayrollReadiness(
      tenantId,
      [memberId],
      excludedFromRun ? [memberId] : [],
    );
    return results[0];
  }

  async assessBulkPayrollReadiness(
    tenantId: string,
    memberIds: string[],
    excludedMemberIds: string[] = [],
  ): Promise<PayrollPaymentReadiness[]> {
    const excludedSet = new Set(excludedMemberIds);
    const lockedMembers = await this.paymentSecurityService.getLockedMemberIds(tenantId, memberIds);

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

      const method = await this.findPrimaryPayoutMethod(tenantId, memberId);
      if (!method) {
        results.push({
          memberId,
          ready: false,
          issues: ['MISSING_PAYMENT_METHOD' as PayrollPaymentIssue],
          message:
            'Add and verify a primary payout method in payment settings (any supported currency).',
        });
        continue;
      }

      const payoutCurrency = (method.currency ?? 'USD').toUpperCase();
      const payoutIsCrypto = isCryptoCurrency(payoutCurrency);
      const issues: PayrollPaymentIssue[] = [];

      if (!method.isVerified) issues.push('UNVERIFIED_PAYMENT_METHOD' as PayrollPaymentIssue);
      if (lockedMembers.has(memberId)) issues.push('LOCKED_PAYMENT_METHOD' as PayrollPaymentIssue);

      if (method.type === PaymentMethodType.CRYPTO || payoutIsCrypto) {
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
        if (payoutCurrency === 'NGN' && !method.bankCode?.trim())
          issues.push('INCOMPLETE_BANK_DETAILS' as PayrollPaymentIssue);
        if (requiresGlobalInstitutionCode(payoutCurrency) && !method.bankCode?.trim())
          issues.push('INCOMPLETE_BANK_DETAILS' as PayrollPaymentIssue);
        if (payoutCurrency !== 'NGN' && !method.country?.trim())
          issues.push('INCOMPLETE_BANK_DETAILS' as PayrollPaymentIssue);
      }

      if (!getSupportedPaymentCurrencies().includes(payoutCurrency) && !payoutIsCrypto)
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
          ? `Ready to pay out to ${payoutCurrency} primary account.`
          : this.buildReadinessMessage(issues, payoutIsCrypto, method.status),
        paymentMethodId: method.id,
        currency: payoutCurrency,
      });
    }
    return results;
  }

  async resolvePayrollPaymentMethod(
    tenantId: string,
    memberId: string,
    _currency?: string,
  ): Promise<PaymentMethod | null> {
    return this.findPrimaryPayoutMethod(tenantId, memberId);
  }

  private buildReadinessMessage(
    issues: PayrollPaymentIssue[],
    payoutIsCrypto = false,
    methodStatus?: PaymentMethodStatus,
  ): string {
    if (issues.includes('MISSING_PAYMENT_METHOD' as PayrollPaymentIssue))
      return 'Set a verified primary payout method in payment settings.';
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
    if (issues.includes('UNSUPPORTED_CURRENCY' as PayrollPaymentIssue))
      return 'Primary payout currency is not supported for automated payouts.';
    if (issues.includes('MISSING_IDENTITY' as PayrollPaymentIssue))
      return 'BVN or NIN is required on this employee profile before payroll.';
    if (payoutIsCrypto) return 'Complete crypto wallet details for the primary payout method.';
    return 'Employee is not ready to receive payroll.';
  }
}
