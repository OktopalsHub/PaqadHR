import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import { TenantMemberRole } from 'src/common/enums/tenant-member.enum';
import type { PaymentMethodSummary } from 'src/common/interfaces/payment-method-summary.interface';
import { ManagerAccessService } from 'src/common/services/manager-access.service';
import { Repository } from 'typeorm';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import type {
  CreatePaymentMethodDto,
  PasscodeChangeDto,
  SubmitForVerificationDto,
  UpdatePaymentMethodDto,
  VerifyPaymentMethodDto,
} from '../dto/payment-method.dto';
import { PaymentMethod } from '../entities/payment-method.entity';
import { NigerianBankService } from './nigerian-bank.service';
import { PaymentSecurityService } from './payment-security.service';
import { PayrollReadinessService } from './payroll-readiness.service';
import { PmCreationService } from './pm-creation.service';
import { PmPasscodeService } from './pm-passcode.service';
import { PmVerificationService } from './pm-verification.service';

@Injectable()
export class PaymentMethodService {
  private readonly logger = new Logger(PaymentMethodService.name);
  constructor(
    @InjectRepository(PaymentMethod) private readonly repo: Repository<PaymentMethod>,
    @InjectRepository(TenantMember) readonly _memberRepo: Repository<TenantMember>,
    private readonly pmCreationService: PmCreationService,
    private readonly pmPasscodeService: PmPasscodeService,
    private readonly pmVerificationService: PmVerificationService,
    private readonly paymentSecurityService: PaymentSecurityService,
    private readonly managerAccessService: ManagerAccessService,
    private readonly nigerianBankService: NigerianBankService,
    private readonly payrollReadinessService: PayrollReadinessService,
  ) {}

  async getAllowedCurrencies(tenantId: string): Promise<string[]> {
    return this.pmCreationService.getAllowedCurrencies(tenantId);
  }

  async createPaymentMethod(
    tenantId: string,
    memberId: string,
    userId: string,
    dto: CreatePaymentMethodDto,
  ) {
    return this.pmCreationService.createPaymentMethod(tenantId, memberId, userId, dto);
  }

  async updatePaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    userId: string,
    dto: UpdatePaymentMethodDto,
  ) {
    return this.pmCreationService.updatePaymentMethod(
      paymentMethodId,
      tenantId,
      memberId,
      userId,
      dto,
    );
  }

  async deletePaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    passcode?: string,
  ) {
    return this.pmCreationService.deletePaymentMethod(
      paymentMethodId,
      tenantId,
      memberId,
      passcode,
    );
  }

  async setPrimaryPaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    passcode: string,
  ) {
    return this.pmCreationService.setPrimaryPaymentMethod(
      paymentMethodId,
      tenantId,
      memberId,
      passcode,
    );
  }

  async changePasscode(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    dto: PasscodeChangeDto,
  ) {
    return this.pmPasscodeService.changePasscode(paymentMethodId, tenantId, memberId, dto);
  }

  async getPasscodeHistory(paymentMethodId: string, tenantId: string, memberId: string) {
    return this.pmPasscodeService.getPasscodeHistory(paymentMethodId, tenantId, memberId);
  }

  async submitForVerification(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    userId: string,
    dto: SubmitForVerificationDto,
  ) {
    return this.pmVerificationService.submitForVerification(
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
    return this.pmVerificationService.verifyPaymentMethod(
      paymentMethodId,
      tenantId,
      dto,
      verifierMemberId,
    );
  }

  async listPendingVerificationForTenant(tenantId: string, excludeMemberId?: string) {
    return this.pmVerificationService.listPendingVerificationForTenant(tenantId, excludeMemberId);
  }

  async getPaymentMethods(
    tenantId: string,
    memberId: string,
    currency?: string,
  ): Promise<PaymentMethodSummary[]> {
    await this.pmCreationService.ensureSinglePrimary(tenantId, memberId);
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

  private withDecrypted(method: PaymentMethod | null): PaymentMethod | null {
    if (!method) return null;
    const d = Object.assign(Object.create(Object.getPrototypeOf(method)), method);
    d.accountNumber = this.pmCreationService.decryptField(method.accountNumber) ?? null;
    d.accountName = this.pmCreationService.decryptField(method.accountName) ?? null;
    return d;
  }

  private formatDisplayInfo(method: PaymentMethod): string {
    const a = this.pmCreationService.decryptField(method.accountNumber) ?? '';
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
}
