import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isCryptoCurrency } from 'src/common/constants/crypto-currencies.constant';
import { AuditAction, AuditSeverity, AuditStatus } from 'src/common/enums/audit-action.enum';
import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import { PaymentMethodType } from 'src/common/enums/payment-type.enum';
import { EncryptionService } from 'src/common/services/encryption.service';
import { Not, Repository } from 'typeorm';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';
import { AuthService } from '../../auth/auth.service';
import { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import { TenantsService } from '../../tenants/tenants.service';
import type { CreatePaymentMethodDto, UpdatePaymentMethodDto } from '../dto/payment-method.dto';
import { PaymentMethod } from '../entities/payment-method.entity';
import {
  normalizeAccountNumber,
  normalizeInstitutionCode,
  requiresGlobalInstitutionCode,
  validateGlobalBankFields,
} from '../utils/global-bank-validation.util';
import { NigerianBankService } from './nigerian-bank.service';
import { PaymentSecurityService } from './payment-security.service';
import {
  assertCurrencyAllowed,
  resolveUpdatedMetadata,
  validatePaymentMethodData,
} from './pm-validation';

@Injectable()
export class PmCreationService {
  private readonly logger = new Logger(PmCreationService.name);
  constructor(
    @InjectRepository(PaymentMethod) private readonly repo: Repository<PaymentMethod>,
    private readonly encryptionService: EncryptionService,
    private readonly auditLogsService: AuditLogsService,
    private readonly paymentSecurityService: PaymentSecurityService,
    private readonly nigerianBankService: NigerianBankService,
    private readonly tenantConfigService: TenantConfigService,
    private readonly tenantsService: TenantsService,
    private readonly authService: AuthService,
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
      validatePaymentMethodData(dto);
      await assertCurrencyAllowed(tenantId, dto.currency, this.tenantConfigService, (id) =>
        this.getAllowedCurrencies(id),
      );
      if (dto.passcode?.length !== 6)
        throw new BadRequestException('Passcode must be exactly 6 characters');
      await this.paymentSecurityService.ensureOrVerifyPasscode(memberId, tenantId, dto.passcode);
      const existingCount = await this.repo.count({ where: { tenantId, memberId } });
      const makePrimary = Boolean(dto.isPrimary) || existingCount === 0;
      if (makePrimary) await this.unsetPrimaryMethods(tenantId, memberId);

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
        isPrimary: makePrimary,
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
          description: `Payment method created (${normalizedCurrency}${makePrimary ? ', primary' : ''})`,
          severity: AuditSeverity.LOW,
          status: AuditStatus.SUCCESS,
          resourceType: 'payment_method',
          resourceId: saved.id,
          tenantId,
          userId,
          metadata: {
            currency: normalizedCurrency,
            type: dto.type || 'bank',
            isPrimary: makePrimary,
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
    if (dto.isPrimary && !pm.isPrimary) await this.unsetPrimaryMethods(tenantId, memberId);

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
      metadata: resolveUpdatedMetadata(pm.type, pm.currency, pm.metadata, dto.metadata),
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

  async setPrimaryPaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    passcode: string,
  ): Promise<PaymentMethod> {
    const pm = await this.repo.findOne({ where: { id: paymentMethodId, tenantId, memberId } });
    if (!pm) throw new NotFoundException('Payment method not found');
    if (pm.status === PaymentMethodStatus.SUSPENDED) {
      throw new BadRequestException('Cannot set a deleted payment method as primary');
    }
    if (!passcode?.trim()) {
      throw new BadRequestException('Passcode is required to change primary payout method');
    }
    await this.paymentSecurityService.ensureOrVerifyPasscode(memberId, tenantId, passcode);
    if (pm.isPrimary) return pm;
    await this.unsetPrimaryMethods(tenantId, memberId);
    pm.isPrimary = true;
    const saved = await this.repo.save(pm);
    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.UPDATE,
        description: `Primary payout method set (${pm.currency})`,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        resourceType: 'payment_method',
        resourceId: paymentMethodId,
        tenantId,
        userId: memberId,
        metadata: { currency: pm.currency, isPrimary: true },
      })
      .catch(() => {});
    return saved;
  }

  encryptField(value?: string | null): string | null | undefined {
    if (!value?.trim()) return value;
    if (this.encryptionService.isEncrypted(value)) return value;
    return this.encryptionService.encrypt(value);
  }

  decryptField(value?: string | null): string | null | undefined {
    if (!value?.trim()) return value;
    if (!this.encryptionService.isEncrypted(value)) return value;
    return this.encryptionService.decrypt(value);
  }

  private async unsetPrimaryMethods(tenantId: string, memberId: string): Promise<void> {
    await this.repo.update({ tenantId, memberId, isPrimary: true }, { isPrimary: false });
  }

  /** Keep a single primary payout method per member (heal legacy per-currency primaries). */
  async ensureSinglePrimary(tenantId: string, memberId: string): Promise<void> {
    const primaries = await this.repo.find({
      where: { tenantId, memberId, isPrimary: true },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
      select: ['id'],
    });
    if (primaries.length <= 1) return;
    await this.repo.update(
      { tenantId, memberId, isPrimary: true, id: Not(primaries[0].id) },
      { isPrimary: false },
    );
  }
}
