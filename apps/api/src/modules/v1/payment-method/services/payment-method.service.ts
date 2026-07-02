import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethodType, TenantMemberRole } from 'src/common/enums';
import { PasswordService } from 'src/common/utils';
import { Repository } from 'typeorm';
import {
  AuditAction,
  AuditSeverity,
  AuditStatus,
} from '../../../../common/enums/audit-action.enum';
import { PasscodeChangeReason } from '../../../../common/enums/passcode-change-reason.enum';
import { PaymentMethodStatus } from '../../../../common/enums/payment-method-status.enum';
import type { PaymentMethodSummary } from '../../../../common/interfaces/payment-method-summary.interface';
import {
  PayrollPaymentIssue,
  type PayrollPaymentReadiness,
} from '../../../../common/interfaces/payroll-payment-readiness.interface';
import { AuditLogsService } from '../../../../common/services/audit-logs.service';
import { EncryptionService } from '../../../../common/services/encryption.service';
import { ManagerAccessService } from '../../../../common/services/manager-access.service';
import { NombaTransferApiService } from '../../../../common/services/nomba-transfer-api.service';
import { PaymentProviderFactoryService } from '../../../../common/services/payment-provider-factory.service';
import { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import { TenantsService } from '../../tenants/tenants.service';
import type {
  CreatePaymentMethodDto,
  PasscodeChangeDto,
  UpdatePaymentMethodDto,
} from '../dto/payment-method.dto';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentMethodPasscodeHistory } from '../entities/payment-method-passcode-history.entity';
import {
  normalizeAccountNumber,
  normalizeInstitutionCode,
  requiresGlobalInstitutionCode,
  validateGlobalBankFields,
} from '../utils/global-bank-validation.util';

@Injectable()
export class PaymentMethodService {
  private readonly logger = new Logger(PaymentMethodService.name);
  private readonly maxFailedAttempts = 5;
  private readonly lockDurationMinutes = 30;
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(PaymentMethodPasscodeHistory)
    private readonly passcodeHistoryRepository: Repository<PaymentMethodPasscodeHistory>,
    readonly _paymentProviderFactory: PaymentProviderFactoryService,
    private readonly nombaTransferApi: NombaTransferApiService,
    private readonly encryptionService: EncryptionService,
    private readonly auditLogsService: AuditLogsService,
    private readonly managerAccessService: ManagerAccessService,
    private readonly tenantConfigService: TenantConfigService,
    private readonly tenantsService: TenantsService,
  ) {}
  async getAllowedCurrencies(tenantId: string): Promise<string[]> {
    try {
      const tenant = await this.tenantsService.getTenant(tenantId);
      return this.tenantConfigService.getPayrollCurrencies(tenantId, tenant.preferredCurrency);
    } catch {
      return this.tenantConfigService.getPayrollCurrencies(tenantId);
    }
  }
  async createPaymentMethod(
    tenantId: string,
    memberId: string,
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    try {
      await this.validatePaymentMethodData(dto);
      await this.assertCurrencyAllowed(tenantId, dto.currency);
      if (!dto.passcode) {
        throw new BadRequestException('Passcode is required to create payment method');
      }
      if (dto.passcode.length !== 6) {
        throw new BadRequestException('Passcode must be exactly 6 characters');
      }
      const passcodeHash = await PasswordService.hashPassword(dto.passcode);
      if (dto.isPrimary) {
        await this.unsetPrimaryMethods(tenantId, memberId, dto.currency);
      }

      let status = PaymentMethodStatus.PENDING_VERIFICATION;
      let accountName = dto.accountName;
      let verifiedAt: Date | null = null;

      if (dto.currency.toUpperCase() === 'NGN') {
        if (!dto.bankCode) {
          throw new BadRequestException('Bank is required for NGN payment methods');
        }
        const lookup = await this.lookupNigerianBankAccount(
          dto.accountNumber!,
          dto.bankCode,
          dto.bankName,
        );
        accountName = lookup.accountName;
        status = PaymentMethodStatus.VERIFIED;
        verifiedAt = new Date();
      }

      const normalizedCurrency = dto.currency.toUpperCase();
      validateGlobalBankFields(normalizedCurrency, dto.accountNumber!, dto.bankCode);
      const normalizedAccountNumber = normalizeAccountNumber(
        normalizedCurrency,
        dto.accountNumber!,
      );
      const normalizedBankCode = dto.bankCode
        ? normalizeInstitutionCode(normalizedCurrency, dto.bankCode)
        : dto.bankCode;

      const paymentMethod = this.paymentMethodRepository.create({
        tenantId,
        memberId,
        type: dto.type || PaymentMethodType.BANK,
        currency: normalizedCurrency,
        displayName: dto.displayName,
        bankName: dto.bankName,
        bankCode: normalizedBankCode,
        accountName: this.encryptField(accountName) ?? accountName,
        accountNumber: this.encryptField(normalizedAccountNumber) ?? normalizedAccountNumber,
        country: dto.country,
        isPrimary: dto.isPrimary || false,
        status,
        verifiedAt,
        passcodeHash,
        passcodeSetAt: new Date(),
        lastPasscodeChange: new Date(),
        metadata: dto.metadata,
      });
      const savedMethod = await this.paymentMethodRepository.save(paymentMethod);
      await this.trackPasscodeChange(
        savedMethod.id,
        memberId,
        PasscodeChangeReason.INITIAL_SETUP,
        'Initial passcode setup during payment method creation',
      );
      this.logger.log(`Payment method created for member ${memberId}: ${savedMethod.id}`);
      return savedMethod;
    } catch (error) {
      this.logger.error('Error creating payment method:', error);
      throw error;
    }
  }
  async updatePaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, tenantId, memberId },
    });
    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }
    await this.verifyPasscode(paymentMethod, dto.currentPasscode);
    if (dto.isPrimary && !paymentMethod.isPrimary && paymentMethod.currency) {
      await this.unsetPrimaryMethods(tenantId, memberId, paymentMethod.currency);
    }

    const updatedCurrency = paymentMethod.currency?.toUpperCase();
    const isNgn = updatedCurrency === 'NGN';
    const hasAccountChanges = !!(dto.accountNumber || dto.bankCode);

    let resolvedAccountName = dto.accountName || this.decryptField(paymentMethod.accountName) || '';
    let status = paymentMethod.status;
    let verifiedAt = paymentMethod.verifiedAt;

    if (isNgn && hasAccountChanges) {
      const accNumber = dto.accountNumber || this.decryptField(paymentMethod.accountNumber) || '';
      const bCode = dto.bankCode || paymentMethod.bankCode || '';
      const bName = dto.bankName || paymentMethod.bankName || '';
      if (!accNumber || !bCode) {
        throw new BadRequestException(
          'Account number and bank code are required for NGN payment methods',
        );
      }
      const lookup = await this.lookupNigerianBankAccount(accNumber, bCode, bName);
      resolvedAccountName = lookup.accountName;
      status = PaymentMethodStatus.VERIFIED;
      verifiedAt = new Date();
    } else if (dto.accountNumber || dto.bankCode) {
      const accNumber = dto.accountNumber ?? this.decryptField(paymentMethod.accountNumber) ?? '';
      const bCode = dto.bankCode ?? paymentMethod.bankCode ?? '';
      if (updatedCurrency && requiresGlobalInstitutionCode(updatedCurrency)) {
        validateGlobalBankFields(updatedCurrency, accNumber, bCode);
        if (dto.accountNumber) {
          dto.accountNumber = normalizeAccountNumber(updatedCurrency, accNumber);
        }
        if (dto.bankCode) {
          dto.bankCode = normalizeInstitutionCode(updatedCurrency, bCode);
        }
      }
      status = PaymentMethodStatus.PENDING_VERIFICATION;
      verifiedAt = null;
    }

    Object.assign(paymentMethod, {
      displayName: dto.displayName ?? paymentMethod.displayName,
      bankName: dto.bankName ?? paymentMethod.bankName,
      bankCode: dto.bankCode ?? paymentMethod.bankCode,
      accountName: this.encryptField(resolvedAccountName) ?? resolvedAccountName,
      accountNumber: dto.accountNumber
        ? (this.encryptField(dto.accountNumber) ?? dto.accountNumber)
        : paymentMethod.accountNumber,
      country: dto.country ?? paymentMethod.country,
      isPrimary: dto.isPrimary ?? paymentMethod.isPrimary,
      metadata: dto.metadata ?? paymentMethod.metadata,
      status,
      verifiedAt,
    });
    if (dto.newPasscode) {
      if (dto.newPasscode.length !== 6) {
        throw new BadRequestException('New passcode must be exactly 6 characters');
      }
      paymentMethod.passcodeHash = await PasswordService.hashPassword(dto.newPasscode);
      paymentMethod.lastPasscodeChange = new Date();
      await this.trackPasscodeChange(
        paymentMethodId,
        memberId,
        PasscodeChangeReason.USER_REQUESTED,
        'Passcode changed during payment method update',
      );
      this.logger.log(`Passcode changed for payment method ${paymentMethodId}`);
    }
    const updatedMethod = await this.paymentMethodRepository.save(paymentMethod);
    this.logger.log(`Payment method updated: ${paymentMethodId}`);
    return updatedMethod;
  }
  async changePasscode(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    dto: PasscodeChangeDto,
  ): Promise<void> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, tenantId, memberId },
    });
    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }
    await this.verifyPasscode(paymentMethod, dto.currentPasscode);
    if (dto.newPasscode.length !== 6) {
      throw new BadRequestException('New passcode must be exactly 6 characters');
    }
    paymentMethod.passcodeHash = await PasswordService.hashPassword(dto.newPasscode);
    paymentMethod.lastPasscodeChange = new Date();
    paymentMethod.failedPasscodeAttempts = 0;
    paymentMethod.lockedUntil = null;
    await this.paymentMethodRepository.save(paymentMethod);
    await this.trackPasscodeChange(
      paymentMethodId,
      memberId,
      PasscodeChangeReason.USER_REQUESTED,
      'Passcode changed via dedicated passcode change endpoint',
    );
    this.logger.log(`Passcode changed for payment method ${paymentMethodId}`);
  }
  async getPaymentMethods(
    tenantId: string,
    memberId: string,
    currency?: string,
  ): Promise<PaymentMethodSummary[]> {
    const query = this.paymentMethodRepository
      .createQueryBuilder('pm')
      .where('pm.tenantId = :tenantId', { tenantId })
      .andWhere('pm.memberId = :memberId', { memberId });
    if (currency) {
      query.andWhere('pm.currency = :currency', {
        currency: currency.toUpperCase(),
      });
    }
    const methods = await query
      .orderBy('pm.isPrimary', 'DESC')
      .addOrderBy('pm.createdAt', 'DESC')
      .getMany();
    return methods.map((method) => ({
      id: method.id,
      type: method.type,
      currency: method.currency || 'USD',
      displayInfo: this.formatDisplayInfo(method),
      status: method.status,
      isPrimary: method.isPrimary,
      isVerified: method.isVerified,
      canReceivePayments: method.canReceivePayments,
      lastUsedAt: method.lastUsedAt,
      createdAt: method.createdAt,
    }));
  }
  async getPrimaryPaymentMethod(
    tenantId: string,
    memberId: string,
    currency: string,
  ): Promise<PaymentMethod | null> {
    return this.paymentMethodRepository.findOne({
      where: {
        tenantId,
        memberId,
        currency: currency.toUpperCase(),
        isPrimary: true,
        status: PaymentMethodStatus.VERIFIED,
      },
    });
  }
  async deletePaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    passcode?: string,
  ): Promise<void> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, tenantId, memberId },
    });
    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }
    if (paymentMethod.passcodeHash) {
      if (!passcode) {
        throw new BadRequestException('Passcode is required to delete this payment method');
      }
      await this.verifyPasscode(paymentMethod, passcode);
    }
    paymentMethod.status = PaymentMethodStatus.SUSPENDED;
    paymentMethod.accountNumber = null;
    paymentMethod.passcodeHash = null;
    paymentMethod.isPrimary = false;
    await this.paymentMethodRepository.save(paymentMethod);
    this.logger.log(`Payment method deleted: ${paymentMethodId}`);
  }
  async verifyPaymentMethod(
    paymentMethodId: string,
    status: PaymentMethodStatus,
    notes?: string,
  ): Promise<PaymentMethod> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId },
    });
    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }
    paymentMethod.status = status;
    paymentMethod.verificationNotes = notes || null;
    if (status === PaymentMethodStatus.VERIFIED) {
      paymentMethod.verifiedAt = new Date();
    }
    const updatedMethod = await this.paymentMethodRepository.save(paymentMethod);
    await this.auditLogsService.queueAuditLog({
      action: AuditAction.UPDATE,
      description: `Payment method verification set to ${status}`,
      severity: AuditSeverity.MEDIUM,
      status: AuditStatus.SUCCESS,
      resourceType: 'payment_method',
      resourceId: paymentMethodId,
      tenantId: paymentMethod.tenantId,
    });
    this.logger.log(`Payment method ${status}: ${paymentMethodId}`);
    return updatedMethod;
  }
  async recordPaymentMethodUsage(paymentMethodId: string): Promise<void> {
    await this.paymentMethodRepository.update({ id: paymentMethodId }, { lastUsedAt: new Date() });
  }
  async findByMemberId(memberId: string): Promise<PaymentMethod | null> {
    try {
      return await this.paymentMethodRepository.findOne({
        where: { memberId },
        order: { updatedAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`Failed to find payment method for member ${memberId}`, error);
      throw error;
    }
  }

  async assessPayrollReadiness(
    tenantId: string,
    memberId: string,
    currency: string,
    excludedFromRun = false,
  ): Promise<PayrollPaymentReadiness> {
    if (excludedFromRun) {
      return {
        memberId,
        ready: false,
        issues: [PayrollPaymentIssue.EXCLUDED_FROM_RUN],
        message: 'Employee was removed from this payroll run and will not be paid.',
      };
    }

    const normalizedCurrency = currency.toUpperCase();
    const method = await this.resolvePayrollPaymentMethod(tenantId, memberId, normalizedCurrency);

    if (!method) {
      return {
        memberId,
        ready: false,
        issues: [PayrollPaymentIssue.MISSING_PAYMENT_METHOD],
        message:
          'Payment settings are not set up yet. This employee will miss this payroll unless you remove them or ask them to add bank details.',
        currency: normalizedCurrency,
      };
    }

    const issues: PayrollPaymentIssue[] = [];

    if (method.currency?.toUpperCase() !== normalizedCurrency) {
      issues.push(PayrollPaymentIssue.CURRENCY_MISMATCH);
    }
    if (!method.isVerified) {
      issues.push(PayrollPaymentIssue.UNVERIFIED_PAYMENT_METHOD);
    }
    if (method.isLocked) {
      issues.push(PayrollPaymentIssue.LOCKED_PAYMENT_METHOD);
    }
    if (!method.accountNumber?.trim() || !method.accountName?.trim() || !method.bankName?.trim()) {
      issues.push(PayrollPaymentIssue.INCOMPLETE_BANK_DETAILS);
    }
    if (normalizedCurrency === 'NGN' && !method.bankCode?.trim()) {
      issues.push(PayrollPaymentIssue.INCOMPLETE_BANK_DETAILS);
    }
    if (requiresGlobalInstitutionCode(normalizedCurrency) && !method.bankCode?.trim()) {
      issues.push(PayrollPaymentIssue.INCOMPLETE_BANK_DETAILS);
    }

    const supported = ['NGN', 'USD', 'GBP', 'EUR', 'KES', 'GHS', 'ZAR'];
    if (!supported.includes(normalizedCurrency)) {
      issues.push(PayrollPaymentIssue.UNSUPPORTED_CURRENCY);
    }

    const ready = issues.length === 0 && method.canReceivePayments;
    const message = ready ? 'Ready for payroll disbursement.' : this.buildReadinessMessage(issues);

    return {
      memberId,
      ready,
      issues,
      message,
      paymentMethodId: method.id,
      currency: method.currency ?? normalizedCurrency,
    };
  }

  async resolvePayrollPaymentMethod(
    tenantId: string,
    memberId: string,
    currency: string,
  ): Promise<PaymentMethod | null> {
    const normalizedCurrency = currency.toUpperCase();

    const primary = await this.getPrimaryPaymentMethod(tenantId, memberId, normalizedCurrency);
    if (primary) return this.withDecrypted(primary);

    const verified = await this.paymentMethodRepository.findOne({
      where: {
        tenantId,
        memberId,
        currency: normalizedCurrency,
        status: PaymentMethodStatus.VERIFIED,
      },
      order: { isPrimary: 'DESC', updatedAt: 'DESC' },
    });
    if (verified) return this.withDecrypted(verified);

    const fallback = await this.paymentMethodRepository.findOne({
      where: { tenantId, memberId, currency: normalizedCurrency },
      order: { isPrimary: 'DESC', updatedAt: 'DESC' },
    });
    return this.withDecrypted(fallback);
  }

  private buildReadinessMessage(issues: PayrollPaymentIssue[]): string {
    if (issues.includes(PayrollPaymentIssue.MISSING_PAYMENT_METHOD)) {
      return 'Payment settings are not set up yet. This employee will miss this payroll unless you remove them or ask them to add bank details.';
    }
    if (issues.includes(PayrollPaymentIssue.UNVERIFIED_PAYMENT_METHOD)) {
      return 'Bank details are pending verification. This employee will miss payment until an admin verifies their account.';
    }
    if (issues.includes(PayrollPaymentIssue.LOCKED_PAYMENT_METHOD)) {
      return 'Payment settings are temporarily locked. Ask the employee to unlock their payment passcode.';
    }
    if (issues.includes(PayrollPaymentIssue.INCOMPLETE_BANK_DETAILS)) {
      return 'Bank account details are incomplete (check routing number, IBAN/BIC, or sort code). This employee will miss payment until their payment settings are completed.';
    }
    if (issues.includes(PayrollPaymentIssue.CURRENCY_MISMATCH)) {
      return 'No verified payment method matches this payroll currency.';
    }
    if (issues.includes(PayrollPaymentIssue.UNSUPPORTED_CURRENCY)) {
      return 'This payroll currency is not supported for automated Nomba payouts.';
    }
    return 'Employee is not ready to receive payroll.';
  }

  async listPendingVerificationForTenant(tenantId: string): Promise<
    Array<{
      id: string;
      memberId: string;
      employeeName: string;
      currency: string;
      displayInfo: string;
      status: PaymentMethodStatus;
      createdAt: Date;
    }>
  > {
    const methods = await this.paymentMethodRepository.find({
      where: {
        tenantId,
        status: PaymentMethodStatus.PENDING_VERIFICATION,
      },
      relations: ['member'],
      order: { createdAt: 'ASC' },
    });

    return methods.map((method) => ({
      id: method.id,
      memberId: method.memberId,
      employeeName: method.member
        ? `${method.member.firstName ?? ''} ${method.member.lastName ?? ''}`.trim()
        : method.memberId,
      currency: method.currency ?? 'NGN',
      displayInfo: this.formatDisplayInfo(method),
      bankName: method.bankName ?? undefined,
      accountName: this.decryptField(method.accountName) ?? undefined,
      institutionCode: method.bankCode ?? undefined,
      accountLast4: this.maskAccountLast4(method.accountNumber),
      status: method.status,
      createdAt: method.createdAt,
    }));
  }

  async findById(id: string): Promise<PaymentMethod | null> {
    try {
      const method = await this.paymentMethodRepository.findOne({
        where: { id },
      });
      return this.withDecrypted(method);
    } catch (error) {
      this.logger.error(`Failed to find payment method ${id}`, error);
      throw error;
    }
  }

  private async assertPaymentMethodAccess(
    tenantId: string,
    targetMemberId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<void> {
    const isAdmin =
      requesterRole === TenantMemberRole.ADMIN || requesterRole === TenantMemberRole.OWNER;
    if (isAdmin || targetMemberId === requesterMemberId) {
      return;
    }
    const isManager = await this.managerAccessService.isManagerOf(
      tenantId,
      requesterMemberId,
      targetMemberId,
    );
    if (!isManager) {
      throw new ForbiddenException('You can only access your own payment methods');
    }
  }

  async findByIdForMember(
    tenantId: string,
    id: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<PaymentMethod | null> {
    const method = await this.paymentMethodRepository.findOne({
      where: { id, tenantId },
    });
    if (!method) {
      return null;
    }
    await this.assertPaymentMethodAccess(
      tenantId,
      method.memberId,
      requesterMemberId,
      requesterRole,
    );
    return this.withDecrypted(method);
  }

  async findByMemberIdForRequester(
    tenantId: string,
    memberId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<PaymentMethod | null> {
    await this.assertPaymentMethodAccess(tenantId, memberId, requesterMemberId, requesterRole);
    try {
      const method = await this.paymentMethodRepository.findOne({
        where: { tenantId, memberId },
        order: { updatedAt: 'DESC' },
      });
      return this.withDecrypted(method);
    } catch (error) {
      this.logger.error(`Failed to find payment method for member ${memberId}`, error);
      throw error;
    }
  }

  private encryptField(value?: string | null): string | null | undefined {
    if (!value?.trim()) return value;
    if (this.encryptionService.isEncrypted(value)) return value;
    return this.encryptionService.encrypt(value);
  }

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

  private formatDisplayInfo(method: PaymentMethod): string {
    const account = this.decryptField(method.accountNumber) ?? '';
    const last4 = account.length >= 4 ? account.slice(-4) : '****';
    return `${method.bankName ?? 'Bank'} - ${last4}`;
  }

  private maskAccountLast4(accountNumber: string | null): string | undefined {
    const account = this.decryptField(accountNumber) ?? '';
    if (!account) return undefined;
    return account.length >= 4 ? account.slice(-4) : account;
  }
  private async verifyPasscode(paymentMethod: PaymentMethod, passcode: string): Promise<void> {
    if (
      !paymentMethod.passcodeHash ||
      paymentMethod.passcodeHash === null ||
      paymentMethod.passcodeHash === undefined
    ) {
      throw new BadRequestException(
        'Payment method does not have a passcode set. Please set a passcode first.',
      );
    }
    if (!passcode || passcode === null || passcode === undefined) {
      throw new BadRequestException('Passcode is required');
    }
    if (paymentMethod.isLocked) {
      throw new UnauthorizedException(
        `Payment method is locked until ${paymentMethod.lockedUntil?.toISOString()}`,
      );
    }
    const isValid = await PasswordService.verifyPassword(paymentMethod.passcodeHash, passcode);
    if (!isValid) {
      paymentMethod.failedPasscodeAttempts += 1;
      if (paymentMethod.failedPasscodeAttempts >= this.maxFailedAttempts) {
        paymentMethod.lockedUntil = new Date(Date.now() + this.lockDurationMinutes * 60 * 1000);
        this.logger.warn(
          `Payment method ${paymentMethod.id} locked due to failed passcode attempts`,
        );
      }
      await this.paymentMethodRepository.save(paymentMethod);
      throw new UnauthorizedException('Invalid passcode');
    }
    if (paymentMethod.failedPasscodeAttempts > 0) {
      paymentMethod.failedPasscodeAttempts = 0;
      paymentMethod.lockedUntil = null;
      await this.paymentMethodRepository.save(paymentMethod);
    }
  }
  private async validatePaymentMethodData(dto: CreatePaymentMethodDto): Promise<void> {
    if (dto.type && dto.type !== PaymentMethodType.BANK) {
      throw new BadRequestException('Only BANK payment method type is supported');
    }
    if (!dto.accountNumber || !dto.accountName || !dto.bankName || !dto.country) {
      throw new BadRequestException(
        'Bank payment method requires account number, account name, bank name, and country',
      );
    }
    const currency = dto.currency.toUpperCase();
    const maxAccountLength = currency === 'EUR' ? 34 : 17;
    if (dto.accountNumber.length > maxAccountLength) {
      throw new BadRequestException(`Account number cannot exceed ${maxAccountLength} characters`);
    }
    validateGlobalBankFields(currency, dto.accountNumber, dto.bankCode);
  }
  private async assertCurrencyAllowed(tenantId: string, currency: string): Promise<void> {
    const allowed = await this.getAllowedCurrencies(tenantId);
    const normalized = currency.toUpperCase();
    if (!allowed.includes(normalized)) {
      throw new BadRequestException(
        `Currency ${normalized} is not enabled for this workspace. Allowed: ${allowed.join(', ')}`,
      );
    }
  }
  private async unsetPrimaryMethods(
    tenantId: string,
    memberId: string,
    currency: string,
  ): Promise<void> {
    await this.paymentMethodRepository.update(
      {
        tenantId,
        memberId,
        currency: currency.toUpperCase(),
        isPrimary: true,
      },
      { isPrimary: false },
    );
  }
  private async trackPasscodeChange(
    paymentMethodId: string,
    memberId: string,
    reason: PasscodeChangeReason,
    notes?: string,
    ipAddress?: string,
    userAgent?: string,
    changedByAdminId?: string,
  ): Promise<void> {
    try {
      const passcodeHistory = this.passcodeHistoryRepository.create({
        paymentMethodId,
        memberId,
        reason,
        changedAt: new Date(),
        ipAddress,
        userAgent,
        changedByAdminId,
        notes,
        wasForced:
          reason === PasscodeChangeReason.SECURITY_RESET ||
          reason === PasscodeChangeReason.ADMIN_RESET,
      });
      await this.passcodeHistoryRepository.save(passcodeHistory);
      this.logger.log(`Passcode change tracked for payment method ${paymentMethodId}: ${reason}`);
    } catch (error) {
      this.logger.error(
        `Error tracking passcode change for payment method ${paymentMethodId}:`,
        error,
      );
    }
  }
  async getPasscodeHistory(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
  ): Promise<PaymentMethodPasscodeHistory[]> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, tenantId, memberId },
    });
    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }
    return this.passcodeHistoryRepository.find({
      where: { paymentMethodId },
      order: { changedAt: 'DESC' },
      take: 10,
    });
  }

  async listNigerianBanks(): Promise<Array<{ code: string; name: string }>> {
    if (!this.nombaTransferApi.isConfigured()) {
      throw new ServiceUnavailableException('Bank lookup is not available in this environment');
    }
    return this.nombaTransferApi.listBanks();
  }

  async lookupNigerianBankAccount(
    accountNumber: string,
    bankCode: string,
    bankName?: string,
  ): Promise<{ accountNumber: string; accountName: string; bankCode: string; bankName: string }> {
    if (!this.nombaTransferApi.isConfigured()) {
      throw new ServiceUnavailableException('Bank lookup is not available in this environment');
    }
    const normalizedNumber = accountNumber.replace(/\D/g, '');
    if (normalizedNumber.length !== 10) {
      throw new BadRequestException('Account number must be 10 digits');
    }
    if (!bankCode?.trim()) {
      throw new BadRequestException('Bank is required');
    }
    const result = await this.nombaTransferApi.lookupBankAccount(normalizedNumber, bankCode.trim());
    return {
      ...result,
      bankCode: bankCode.trim(),
      bankName: bankName?.trim() || bankCode.trim(),
    };
  }
}
