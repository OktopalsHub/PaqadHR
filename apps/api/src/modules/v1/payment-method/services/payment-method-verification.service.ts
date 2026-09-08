import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditAction, AuditSeverity, AuditStatus } from 'src/common/enums/audit-action.enum';
import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import { TenantMemberRole } from 'src/common/enums/tenant-member.enum';
import { ProductAnalyticsService } from 'src/common/observability/product-analytics.service';
import { EncryptionService } from 'src/common/services/encryption.service';
import { Repository } from 'typeorm';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';
import { AuthService } from '../../auth/auth.service';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import type { SubmitForVerificationDto, VerifyPaymentMethodDto } from '../dto/payment-method.dto';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentSecurityService } from './payment-security.service';

@Injectable()
export class PaymentMethodVerificationService {
  private readonly logger = new Logger(PaymentMethodVerificationService.name);

  constructor(
    @InjectRepository(PaymentMethod) private readonly repo: Repository<PaymentMethod>,
    @InjectRepository(TenantMember) private readonly memberRepo: Repository<TenantMember>,
    private readonly authService: AuthService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationHelper: NotificationHelperService,
    private readonly paymentSecurityService: PaymentSecurityService,
    private readonly encryptionService: EncryptionService,
    private readonly productAnalytics: ProductAnalyticsService,
  ) {}

  private decryptField(value?: string | null): string | null | undefined {
    if (!value?.trim()) return value;
    if (!this.encryptionService.isEncrypted(value)) return value;
    return this.encryptionService.decrypt(value);
  }
  private maskAccountLast4(accountNumber: string | null): string | undefined {
    const a = this.decryptField(accountNumber) ?? '';
    return a.length >= 4 ? a.slice(-4) : a || undefined;
  }
  private formatDisplayInfo(method: PaymentMethod): string {
    const a = this.decryptField(method.accountNumber) ?? '';
    return `${method.bankName ?? 'Bank'} - ${a.length >= 4 ? a.slice(-4) : '****'}`;
  }

  async submitForVerification(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    userId: string,
    dto: SubmitForVerificationDto,
  ): Promise<PaymentMethod> {
    this.authService.assertOtpProof(dto.otpProof, userId, 'payment_method');
    const pm = await this.repo.findOne({
      where: { id: paymentMethodId, tenantId, memberId },
      relations: ['member'],
    });
    if (!pm) throw new NotFoundException('Payment method not found');
    if (pm.status !== PaymentMethodStatus.DRAFT && pm.status !== PaymentMethodStatus.REJECTED)
      throw new BadRequestException('Only draft or rejected payment methods can be submitted');
    await this.paymentSecurityService.ensureOrVerifyPasscode(memberId, tenantId, dto.passcode);
    pm.status = PaymentMethodStatus.PENDING_VERIFICATION;
    pm.submittedAt = new Date();
    pm.verificationNotes = null;
    const saved = await this.repo.save(pm);

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.PAYMENT_METHOD_SUBMITTED,
        description: `Payment method submitted (${pm.currency}${pm.isPrimary ? ', primary' : ''})`,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        resourceType: 'payment_method',
        resourceId: saved.id,
        tenantId,
        userId,
        metadata: { currency: pm.currency, isPrimary: pm.isPrimary },
      })
      .catch(() => {});
    this.productAnalytics.capture(userId, 'payment_method_submitted', {
      userId,
      tenantId,
      role: 'member',
    });

    const employeeName = pm.member
      ? `${pm.member.firstName ?? ''} ${pm.member.lastName ?? ''}`.trim()
      : 'Employee';
    void this.notificationHelper
      .sendPaymentMethodSubmittedEmployeeNotification(memberId, tenantId, {
        currency: pm.currency ?? 'NGN',
        paymentMethodId: saved.id,
      })
      .catch((e) => this.logger.error('Failed to send notification', e));
    void this.notifyAdmins(tenantId, employeeName, pm.currency ?? 'NGN', saved.id).catch((e) =>
      this.logger.error('Failed to notify admins', e),
    );
    return saved;
  }

  async verifyPaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    dto: VerifyPaymentMethodDto,
    verifierMemberId: string,
  ): Promise<PaymentMethod> {
    if (
      ![
        PaymentMethodStatus.VERIFIED,
        PaymentMethodStatus.REJECTED,
        PaymentMethodStatus.SUSPENDED,
      ].includes(dto.status)
    )
      throw new BadRequestException('Status must be verified, rejected, or suspended');
    if (dto.status === PaymentMethodStatus.REJECTED && !dto.notes?.trim())
      throw new BadRequestException('Rejection reason is required');
    const pm = await this.repo.findOne({ where: { id: paymentMethodId, tenantId } });
    if (!pm) throw new NotFoundException('Payment method not found');
    if (pm.memberId === verifierMemberId)
      throw new ForbiddenException('You cannot verify your own payment account');
    if (
      (dto.status === PaymentMethodStatus.VERIFIED ||
        dto.status === PaymentMethodStatus.REJECTED) &&
      pm.status !== PaymentMethodStatus.PENDING_VERIFICATION
    )
      throw new BadRequestException(
        'Only pending verification methods can be approved or rejected',
      );
    pm.status = dto.status;
    pm.verificationNotes = dto.notes?.trim() || null;
    if (dto.status === PaymentMethodStatus.VERIFIED) pm.verifiedAt = new Date();
    const updated = await this.repo.save(pm);

    await this.auditLogsService.queueAuditLog({
      action:
        dto.status === PaymentMethodStatus.VERIFIED
          ? AuditAction.PAYMENT_METHOD_VERIFIED
          : dto.status === PaymentMethodStatus.REJECTED
            ? AuditAction.PAYMENT_METHOD_REJECTED
            : AuditAction.PAYMENT_METHOD_UPDATED,
      description: `Payment method ${dto.status}${dto.notes ? `: ${dto.notes}` : ''}`,
      severity: AuditSeverity.MEDIUM,
      status: AuditStatus.SUCCESS,
      resourceType: 'payment_method',
      resourceId: paymentMethodId,
      tenantId: pm.tenantId,
      metadata: {
        currency: pm.currency,
        previousStatus: pm.status,
        newStatus: dto.status,
        isPrimary: pm.isPrimary,
      },
    });

    if (dto.status === PaymentMethodStatus.VERIFIED)
      void this.notificationHelper
        .sendPaymentMethodVerifiedNotification(pm.memberId, tenantId, {
          currency: pm.currency ?? 'NGN',
          paymentMethodId,
        })
        .catch((e) => this.logger.error('Failed to send verified notification', e));
    else if (dto.status === PaymentMethodStatus.REJECTED)
      void this.notificationHelper
        .sendPaymentMethodRejectedNotification(pm.memberId, tenantId, {
          currency: pm.currency ?? 'NGN',
          reason: dto.notes?.trim() ?? 'No reason provided',
          paymentMethodId,
        })
        .catch((e) => this.logger.error('Failed to send rejected notification', e));
    return updated;
  }

  async listPendingVerificationForTenant(tenantId: string, excludeMemberId?: string) {
    const methods = await this.repo.find({
      where: { tenantId, status: PaymentMethodStatus.PENDING_VERIFICATION },
      relations: ['member'],
      order: { submittedAt: 'ASC', createdAt: 'ASC' },
    });
    return methods
      .filter((m) => m.memberId !== excludeMemberId)
      .map((m) => ({
        id: m.id,
        memberId: m.memberId,
        employeeName: m.member
          ? `${m.member.firstName ?? ''} ${m.member.lastName ?? ''}`.trim()
          : m.memberId,
        currency: m.currency ?? 'NGN',
        displayInfo: this.formatDisplayInfo(m),
        bankName: m.bankName ?? undefined,
        accountName: this.decryptField(m.accountName) ?? undefined,
        institutionCode: m.bankCode ?? undefined,
        accountLast4: this.maskAccountLast4(m.accountNumber),
        isPrimary: m.isPrimary,
        status: m.status,
        createdAt: m.createdAt,
        submittedAt: m.submittedAt,
      }));
  }

  private async notifyAdmins(
    tenantId: string,
    employeeName: string,
    currency: string,
    paymentMethodId: string,
  ) {
    const admins = await this.memberRepo.find({
      where: [
        { tenantId, role: TenantMemberRole.ADMIN },
        { tenantId, role: TenantMemberRole.OWNER },
      ],
      select: ['id'],
    });
    const ids = admins.map((a) => a.id);
    if (ids.length > 0)
      await this.notificationHelper.sendPaymentMethodSubmittedAdminNotification(ids, tenantId, {
        employeeName,
        currency,
        paymentMethodId,
      });
  }
}
