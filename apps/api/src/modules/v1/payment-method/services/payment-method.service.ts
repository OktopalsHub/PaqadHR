import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  isCryptoCurrency,
  normalizeCryptoNetwork,
} from 'src/common/constants/crypto-currencies.constant';
import { AuditAction, AuditSeverity, AuditStatus } from 'src/common/enums/audit-action.enum';
import { PasscodeChangeReason } from 'src/common/enums/passcode-change-reason.enum';
import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import { PaymentMethodType } from 'src/common/enums/payment-type.enum';
import { TenantMemberRole } from 'src/common/enums/tenant-member.enum';
import type { PaymentMethodSummary } from 'src/common/interfaces/payment-method-summary.interface';
import { EncryptionService } from 'src/common/services/encryption.service';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { Repository } from 'typeorm';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';
import { AuthService } from '../../auth/auth.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import { TenantsService } from '../../tenants/tenants.service';
import type {
  CreatePaymentMethodDto,
  PasscodeChangeDto,
  SubmitForVerificationDto,
  UpdatePaymentMethodDto,
  VerifyPaymentMethodDto,
} from '../dto/payment-method.dto';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentMethodPasscodeHistory } from '../entities/payment-method-passcode-history.entity';
import {
  normalizeAccountNumber,
  normalizeInstitutionCode,
  requiresGlobalInstitutionCode,
  validateGlobalBankFields,
} from '../utils/global-bank-validation.util';
import { NigerianBankService } from './nigerian-bank.service';
import { PaymentMethodVerificationService } from './payment-method-verification.service';
import { PaymentSecurityService } from './payment-security.service';
import { PayrollReadinessService } from './payroll-readiness.service';

@Injectable()
export class PaymentMethodService {
  private readonly logger = new Logger(PaymentMethodService.name);

  constructor(
    @InjectRepository(PaymentMethod) private readonly repo: Repository<PaymentMethod>,
    @InjectRepository(PaymentMethodPasscodeHistory)
    private readonly historyRepo: Repository<PaymentMethodPasscodeHistory>,
    @InjectRepository(TenantMember) readonly _memberRepo: Repository<TenantMember>,
    private readonly encryptionService: EncryptionService,
    private readonly auditLogsService: AuditLogsService,
    private readonly managerAccessService: ManagerAccessService,
    private readonly tenantConfigService: TenantConfigService,
    private readonly tenantsService: TenantsService,
    private readonly authService: AuthService,
    private readonly paymentSecurityService: PaymentSecurityService,
    private readonly nigerianBankService: NigerianBankService,
    private readonly payrollReadinessService: PayrollReadinessService,
    private readonly verificationService: PaymentMethodVerificationService,
  ) {}

  async getAllowedCurrencies(tenantId: string): Promise<string[]> {
    try {
      const t = await this.tenantsService.getTenant(tenantId);
      return this.tenantConfigService.getPayrollCurrencies(tenantId, t.preferredCurrency);
    } catch {
      return this.tenantConfigService.getPayrollCurrencies(tenantId);
    }
  }

  async createPaymentMethod(
    tenantId: string,
    memberId: string,
    userId: string,
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    try {
      this.authService.assertOtpProof(dto.otpProof, userId, 'payment_method');
      await this.validatePaymentMethodData(dto);
      await this.assertCurrencyAllowed(tenantId, dto.currency);
      if (dto.passcode?.length !== 6)
        throw new BadRequestException('Passcode must be exactly 6 characters');
      await this.paymentSecurityService.ensureOrVerifyPasscode(memberId, tenantId, dto.passcode);
      if (dto.isPrimary) await this.unsetPrimaryMethods(tenantId, memberId, dto.currency);

      const status = PaymentMethodStatus.DRAFT;
      let accountName = dto.accountName;
      if (dto.currency.toUpperCase() === 'NGN') {
        if (!dto.bankCode) throw new BadRequestException('Bank is required for NGN');
        const r = await this.nigerianBankService.resolveBankAccount(
          dto.accountNumber!,
          dto.bankCode,
          dto.bankName,
          dto.accountName,
        );
        accountName = r.accountName;
        if (r.bankName) dto.bankName = r.bankName;
      } else if (dto.type === PaymentMethodType.CRYPTO || isCryptoCurrency(dto.currency)) {
        if (!dto.accountNumber?.trim())
          throw new BadRequestException('Wallet address is required for crypto');
        accountName = dto.accountName ?? dto.displayName ?? 'Crypto wallet';
      }

      const normalizedCurrency = dto.currency.toUpperCase();
      const isCryptoMethod =
        dto.type === PaymentMethodType.CRYPTO || isCryptoCurrency(normalizedCurrency);
      const rawAccount = isCryptoMethod
        ? (dto.walletAddress ?? dto.accountNumber ?? '')
        : dto.accountNumber!;
      if (dto.type !== PaymentMethodType.CRYPTO && !isCryptoCurrency(normalizedCurrency))
        validateGlobalBankFields(normalizedCurrency, rawAccount, dto.bankCode);
      const normalizedAccount = isCryptoMethod
        ? rawAccount.trim()
        : normalizeAccountNumber(normalizedCurrency, rawAccount);
      const normalizedBankCode = dto.bankCode
        ? normalizeInstitutionCode(normalizedCurrency, dto.bankCode)
        : dto.bankCode;

      const pm = this.repo.create({
        tenantId,
        memberId,
        type: dto.type || PaymentMethodType.BANK,
        currency: normalizedCurrency,
        displayName: dto.displayName,
        bankName: dto.bankName,
        bankCode: normalizedBankCode,
        accountName: this.encryptField(accountName) ?? accountName,
        accountNumber: this.encryptField(normalizedAccount) ?? normalizedAccount,
        country: dto.country,
        isPrimary: dto.isPrimary || false,
        status,
        verifiedAt: null,
        passcodeHash: null,
        passcodeSetAt: null,
        lastPasscodeChange: null,
        metadata: {
          ...(dto.metadata ?? {}),
          ...(dto.cryptoNetwork ? { cryptoNetwork: dto.cryptoNetwork } : {}),
          ...(dto.walletAddress ? { walletAddress: dto.walletAddress } : {}),
        },
      });
      const saved = await this.repo.save(pm);
      void this.auditLogsService
        .queueAuditLog({
          action: AuditAction.CREATE,
          description: `Payment method created (${normalizedCurrency}${dto.isPrimary ? ', primary' : ''})`,
          severity: AuditSeverity.LOW,
          status: AuditStatus.SUCCESS,
          resourceType: 'payment_method',
          resourceId: saved.id,
          tenantId,
          userId,
          metadata: {
            currency: normalizedCurrency,
            type: dto.type || 'bank',
            isPrimary: dto.isPrimary || false,
          },
        })
        .catch(() => {});
      return saved;
    } catch (error) {
      this.logger.error('Error creating payment method:', error);
      throw error;
    }
  }

  async updatePaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    userId: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    this.authService.assertOtpProof(dto.otpProof, userId, 'payment_method');
    const pm = await this.repo.findOne({ where: { id: paymentMethodId, tenantId, memberId } });
    if (!pm) throw new NotFoundException('Payment method not found');
    await this.paymentSecurityService.ensureOrVerifyPasscode(
      memberId,
      tenantId,
      dto.currentPasscode,
    );
    if (dto.isPrimary && !pm.isPrimary && pm.currency)
      await this.unsetPrimaryMethods(tenantId, memberId, pm.currency);

    const updatedCurrency = pm.currency?.toUpperCase();
    const isNgn = updatedCurrency === 'NGN';
    const hasChanges = !!(dto.accountNumber || dto.bankCode);
    let resolvedName = dto.accountName || this.decryptField(pm.accountName) || '';
    let status = pm.status;
    let verifiedAt = pm.verifiedAt;

    if (isNgn && hasChanges) {
      const acc = dto.accountNumber || this.decryptField(pm.accountNumber) || '';
      const bc = dto.bankCode || pm.bankCode || '';
      if (!acc || !bc)
        throw new BadRequestException('Account number and bank code are required for NGN');
      const r = await this.nigerianBankService.resolveBankAccount(
        acc,
        bc,
        dto.bankName || pm.bankName || '',
        dto.accountName || resolvedName,
      );
      resolvedName = r.accountName;
      status = r.status;
      verifiedAt = r.verifiedAt;
      if (r.bankName) dto.bankName = r.bankName;
    } else if (
      dto.accountNumber ||
      dto.bankCode ||
      dto.accountName ||
      dto.bankName ||
      (dto.country !== undefined && dto.country !== pm.country)
    ) {
      const acc = dto.accountNumber ?? this.decryptField(pm.accountNumber) ?? '';
      const bc = dto.bankCode ?? pm.bankCode ?? '';
      if (updatedCurrency && requiresGlobalInstitutionCode(updatedCurrency)) {
        validateGlobalBankFields(updatedCurrency, acc, bc);
        if (dto.accountNumber) dto.accountNumber = normalizeAccountNumber(updatedCurrency, acc);
        if (dto.bankCode) dto.bankCode = normalizeInstitutionCode(updatedCurrency, bc);
      }
      status = PaymentMethodStatus.DRAFT;
      verifiedAt = null;
      pm.submittedAt = null;
    }

    Object.assign(pm, {
      displayName: dto.displayName ?? pm.displayName,
      bankName: dto.bankName ?? pm.bankName,
      bankCode: dto.bankCode ?? pm.bankCode,
      accountName: this.encryptField(resolvedName) ?? resolvedName,
      accountNumber: dto.accountNumber
        ? (this.encryptField(dto.accountNumber) ?? dto.accountNumber)
        : pm.accountNumber,
      country: dto.country ?? pm.country,
      isPrimary: dto.isPrimary ?? pm.isPrimary,
      metadata: this.resolveUpdatedMetadata(pm, dto.metadata),
      status,
      verifiedAt,
    });
    return this.repo.save(pm);
  }

  async deletePaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    passcode?: string,
  ): Promise<void> {
    const pm = await this.repo.findOne({ where: { id: paymentMethodId, tenantId, memberId } });
    if (!pm) throw new NotFoundException('Payment method not found');
    if (!passcode)
      throw new BadRequestException('Passcode is required to delete this payment method');
    await this.paymentSecurityService.ensureOrVerifyPasscode(memberId, tenantId, passcode);
    pm.status = PaymentMethodStatus.SUSPENDED;
    pm.accountNumber = null;
    pm.passcodeHash = null;
    pm.isPrimary = false;
    await this.repo.save(pm);
    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.DELETE,
        description: `Payment method deleted (${pm.currency})`,
        severity: AuditSeverity.MEDIUM,
        status: AuditStatus.SUCCESS,
        resourceType: 'payment_method',
        resourceId: paymentMethodId,
        tenantId,
        userId: memberId,
        metadata: { currency: pm.currency },
      })
      .catch(() => {});
  }

  async changePasscode(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    dto: PasscodeChangeDto,
  ): Promise<void> {
    const pm = await this.repo.findOne({ where: { id: paymentMethodId, tenantId, memberId } });
    if (!pm) throw new NotFoundException('Payment method not found');
    await this.paymentSecurityService.changePasscode(
      memberId,
      tenantId,
      dto.currentPasscode,
      dto.newPasscode,
    );
    await this.trackPasscodeChange(
      paymentMethodId,
      memberId,
      PasscodeChangeReason.USER_REQUESTED,
      'Member payment passcode changed',
    );
  }

  async getPaymentMethods(
    tenantId: string,
    memberId: string,
    currency?: string,
  ): Promise<PaymentMethodSummary[]> {
    const q = this.repo
      .createQueryBuilder('pm')
      .where('pm.tenantId = :tenantId', { tenantId })
      .andWhere('pm.memberId = :memberId', { memberId })
      .andWhere('pm.status != :s', { s: PaymentMethodStatus.SUSPENDED });
    if (currency) q.andWhere('pm.currency = :currency', { currency: currency.toUpperCase() });
    const methods = await q
      .orderBy('pm.isPrimary', 'DESC')
      .addOrderBy('pm.createdAt', 'DESC')
      .getMany();
    const locked = await this.paymentSecurityService.isLocked(memberId, tenantId);
    return methods.map((m) => ({
      id: m.id,
      type: m.type,
      currency: m.currency || 'USD',
      displayInfo: this.formatDisplayInfo(m),
      status: m.status,
      isPrimary: m.isPrimary,
      isVerified: m.isVerified,
      canReceivePayments: m.isVerified && !locked,
      lastUsedAt: m.lastUsedAt,
      createdAt: m.createdAt,
      verificationNotes: m.status === PaymentMethodStatus.REJECTED ? m.verificationNotes : null,
      submittedAt: m.submittedAt,
    }));
  }

  async getPrimaryPaymentMethod(
    tenantId: string,
    memberId: string,
    currency: string,
  ): Promise<PaymentMethod | null> {
    return this.repo.findOne({
      where: {
        tenantId,
        memberId,
        currency: currency.toUpperCase(),
        isPrimary: true,
        status: PaymentMethodStatus.VERIFIED,
      },
    });
  }
  async recordPaymentMethodUsage(paymentMethodId: string): Promise<void> {
    await this.repo.update({ id: paymentMethodId }, { lastUsedAt: new Date() });
  }
  async findByMemberId(memberId: string, tenantId: string): Promise<PaymentMethod | null> {
    try {
      return await this.repo.findOne({
        where: { memberId, tenantId },
        order: { updatedAt: 'DESC' },
      });
    } catch (e) {
      this.logger.error(`Failed to find payment method for member ${memberId}`, e);
      throw e;
    }
  }
  async findById(id: string, tenantId: string): Promise<PaymentMethod | null> {
    try {
      return this.withDecrypted(await this.repo.findOne({ where: { id, tenantId } }));
    } catch (e) {
      this.logger.error(`Failed to find payment method ${id}`, e);
      throw e;
    }
  }

  async findByIdForMember(
    tenantId: string,
    id: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<PaymentMethod | null> {
    const pm = await this.repo.findOne({ where: { id, tenantId } });
    if (!pm) return null;
    await this.assertPaymentMethodAccess(tenantId, pm.memberId, requesterMemberId, requesterRole);
    return this.withDecrypted(pm);
  }

  async findByMemberIdForRequester(
    tenantId: string,
    memberId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<PaymentMethod | null> {
    await this.assertPaymentMethodAccess(tenantId, memberId, requesterMemberId, requesterRole);
    try {
      return this.withDecrypted(
        await this.repo.findOne({ where: { tenantId, memberId }, order: { updatedAt: 'DESC' } }),
      );
    } catch (e) {
      this.logger.error(`Failed to find payment method for member ${memberId}`, e);
      throw e;
    }
  }

  async getPasscodeHistory(paymentMethodId: string, tenantId: string, memberId: string) {
    const pm = await this.repo.findOne({ where: { id: paymentMethodId, tenantId, memberId } });
    if (!pm) throw new NotFoundException('Payment method not found');
    return this.historyRepo.find({
      where: { paymentMethodId },
      order: { changedAt: 'DESC' },
      take: 10,
    });
  }

  async listNigerianBanks() {
    return this.nigerianBankService.listBanks();
  }
  async lookupNigerianBankAccount(accountNumber: string, bankCode: string, bankName?: string) {
    return this.nigerianBankService.lookupBankAccount(accountNumber, bankCode, bankName);
  }
  async assessPayrollReadiness(
    tenantId: string,
    memberId: string,
    currency: string,
    excludedFromRun?: boolean,
  ) {
    return this.payrollReadinessService.assessPayrollReadiness(
      tenantId,
      memberId,
      currency,
      excludedFromRun,
    );
  }
  async assessBulkPayrollReadiness(
    tenantId: string,
    memberIds: string[],
    currency: string,
    excludedMemberIds?: string[],
  ) {
    return this.payrollReadinessService.assessBulkPayrollReadiness(
      tenantId,
      memberIds,
      currency,
      excludedMemberIds,
    );
  }
  async resolvePayrollPaymentMethod(tenantId: string, memberId: string, currency: string) {
    return this.payrollReadinessService.resolvePayrollPaymentMethod(tenantId, memberId, currency);
  }
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
    const d = Object.assign(Object.create(Object.getPrototypeOf(method)), method);
    d.accountNumber = this.decryptField(method.accountNumber) ?? null;
    d.accountName = this.decryptField(method.accountName) ?? null;
    return d;
  }
  private formatDisplayInfo(method: PaymentMethod): string {
    const a = this.decryptField(method.accountNumber) ?? '';
    return `${method.bankName ?? 'Bank'} - ${a.length >= 4 ? a.slice(-4) : '****'}`;
  }

  private async assertPaymentMethodAccess(
    tenantId: string,
    targetMemberId: string,
    requesterMemberId: string,
    requesterRole: string,
  ): Promise<void> {
    if (
      requesterRole === TenantMemberRole.ADMIN ||
      requesterRole === TenantMemberRole.OWNER ||
      targetMemberId === requesterMemberId
    )
      return;
    if (await this.managerAccessService.isManagerOf(tenantId, requesterMemberId, targetMemberId))
      return;
    throw new ForbiddenException('You can only access your own payment methods');
  }

  private async validatePaymentMethodData(dto: CreatePaymentMethodDto): Promise<void> {
    const isCrypto = dto.type === PaymentMethodType.CRYPTO || isCryptoCurrency(dto.currency);
    if (isCrypto) {
      const w = dto.walletAddress ?? dto.accountNumber;
      if (!w?.trim()) throw new BadRequestException('Crypto requires a wallet address');
      if (!dto.currency?.trim()) throw new BadRequestException('Crypto requires a currency code');
      dto.cryptoNetwork = this.assertAndCanonicalizeCryptoNetwork(dto.currency, dto.cryptoNetwork);
      return;
    }
    if (dto.type && dto.type !== PaymentMethodType.BANK)
      throw new BadRequestException('Unsupported payment method type');
    if (!dto.accountNumber || !dto.accountName || !dto.bankName || !dto.country)
      throw new BadRequestException(
        'Bank payment method requires account number, name, bank name, and country',
      );
    const maxLen = dto.currency.toUpperCase() === 'EUR' ? 34 : 17;
    if (dto.accountNumber.length > maxLen)
      throw new BadRequestException(`Account number cannot exceed ${maxLen} characters`);
    validateGlobalBankFields(dto.currency.toUpperCase(), dto.accountNumber, dto.bankCode);
  }

  private resolveUpdatedMetadata(pm: PaymentMethod, metadata: Record<string, unknown> | undefined) {
    if (metadata === undefined) return pm.metadata;
    if (pm.type !== PaymentMethodType.CRYPTO && !isCryptoCurrency(pm.currency ?? ''))
      return metadata;
    return {
      ...metadata,
      cryptoNetwork: this.assertAndCanonicalizeCryptoNetwork(
        pm.currency ?? '',
        metadata.cryptoNetwork,
      ),
    };
  }

  private assertAndCanonicalizeCryptoNetwork(currency: string, network: unknown): string {
    if (typeof network !== 'string' || !network.trim())
      throw new BadRequestException('Crypto requires a network');
    const canonical = normalizeCryptoNetwork(currency, network);
    if (!canonical)
      throw new BadRequestException(
        `Unsupported network for ${currency.toUpperCase()}: ${network.trim()}`,
      );
    return canonical;
  }

  private async assertCurrencyAllowed(tenantId: string, currency: string): Promise<void> {
    const n = currency.toUpperCase();
    if (isCryptoCurrency(n)) {
      if (!(await this.tenantConfigService.isCryptoEnabled(tenantId)))
        throw new BadRequestException('Crypto payouts not enabled');
      return;
    }
    const allowed = await this.getAllowedCurrencies(tenantId);
    if (!allowed.includes(n))
      throw new BadRequestException(`Currency ${n} not enabled. Allowed: ${allowed.join(', ')}`);
  }

  private async unsetPrimaryMethods(
    tenantId: string,
    memberId: string,
    currency: string,
  ): Promise<void> {
    await this.repo.update(
      { tenantId, memberId, currency: currency.toUpperCase(), isPrimary: true },
      { isPrimary: false },
    );
  }

  private async trackPasscodeChange(
    paymentMethodId: string,
    memberId: string,
    reason: PasscodeChangeReason,
    notes?: string,
  ) {
    try {
      await this.historyRepo.save(
        this.historyRepo.create({
          paymentMethodId,
          memberId,
          reason,
          changedAt: new Date(),
          notes,
          wasForced:
            reason === PasscodeChangeReason.SECURITY_RESET ||
            reason === PasscodeChangeReason.ADMIN_RESET,
        }),
      );
    } catch (e) {
      this.logger.error(`Error tracking passcode change for ${paymentMethodId}:`, e);
    }
  }
}
