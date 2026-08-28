import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import { CloudflareR2Service } from 'src/common/services/cloudflare-r2.service';
import { EncryptionService } from 'src/common/services/encryption.service';
import { StringUtility } from 'src/common/utils';
import { In, Repository } from 'typeorm';
import { AuditAction, AuditSeverity, AuditStatus } from '../../../common/enums/audit-action.enum';
import { Address } from '../address/entities/address.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { AuditLogsService } from '../audit-logs/services/audit-logs.service';
import { Account } from '../auth/entities/account.entity';
import { Session } from '../auth/entities/session.entity';
import { Verification } from '../auth/entities/verification.entity';
import { Document } from '../document/entities/document.entity';
import { Education } from '../education/entities/education.entity';
import { EmergencyContact } from '../emergency-contact/entities/emergency-contact.entity';
import { Employment } from '../employment/entities/employment.entity';
import { Leave } from '../leave/entities/leave.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { PaymentMethod } from '../payment-method/entities/payment-method.entity';
import { PayrollItem } from '../payroll/entities/payroll-item.entity';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import type { User } from './entities/user.entity';
import {
  buildUserConsentMetadata,
  getCurrentPrivacyPolicyVersion,
  getUserConsent,
  needsPrivacyPolicyReconsent,
} from './interfaces/user-metadata.interface';
import { UserRepository } from './repositories/users.repository';
import { buildDeletedUserEmail } from './utils/user-tombstone.util';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly userRepository: UserRepository,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    @InjectRepository(TenantMember)
    private readonly tenantMemberRepository: Repository<TenantMember>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Employment)
    private readonly employmentRepository: Repository<Employment>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(Leave)
    private readonly leaveRepository: Repository<Leave>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(Education)
    private readonly educationRepository: Repository<Education>,
    @InjectRepository(EmergencyContact)
    private readonly emergencyContactRepository: Repository<EmergencyContact>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepository: Repository<PayrollItem>,
    @InjectRepository(NotificationPreference)
    private readonly notificationPreferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly auditLogsService: AuditLogsService,
    private readonly r2Service: CloudflareR2Service,
    private readonly encryptionService: EncryptionService,
  ) {}

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findUser(userId);
    if (!user) {
      throw new NotFoundException('User Not found');
    }
    return user;
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findUser(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const members = await this.tenantMemberRepository.find({ where: { userId } });
    const memberIds = members.map((member) => member.id);

    const fileKeys = new Set<string>();
    if (user.imageKey) {
      fileKeys.add(user.imageKey);
    }
    for (const member of members) {
      if (member.avatarKey) {
        fileKeys.add(member.avatarKey);
      }
    }

    if (memberIds.length > 0) {
      const memberDocuments = await this.documentRepository.find({
        where: { tenantMemberId: In(memberIds) },
        select: ['id', 'fileKey'],
      });
      for (const document of memberDocuments) {
        if (document.fileKey) {
          fileKeys.add(document.fileKey);
        }
      }

      await this.paymentMethodRepository
        .createQueryBuilder()
        .update(PaymentMethod)
        .set({
          accountNumber: null,
          accountName: null,
          bankCode: null,
          bankName: null,
          passcodeHash: null,
          status: PaymentMethodStatus.SUSPENDED,
          isPrimary: false,
        })
        .where('member_id IN (:...memberIds)', { memberIds })
        .execute();

      await Promise.all([
        this.emergencyContactRepository.delete({ tenantMemberId: In(memberIds) }),
        this.addressRepository.delete({ tenantMemberId: In(memberIds) }),
        this.educationRepository.delete({ tenantMemberId: In(memberIds) }),
        this.leaveRepository.update({ requestedBy: In(memberIds) }, { reason: '', comments: '' }),
        this.attendanceRepository.update({ tenantMemberId: In(memberIds) }, { notes: '' }),
        this.employmentRepository.update({ tenantMemberId: In(memberIds) }, { comments: '' }),
        this.notificationRepository.delete({ recipientId: In(memberIds) }),
        this.documentRepository.delete({ tenantMemberId: In(memberIds) }),
        this.tenantMemberRepository.update(
          { userId },
          {
            firstName: null,
            lastName: null,
            middleName: null,
            preferredName: null,
            phone: null,
            dateOfBirth: null,
            gender: null,
            identityBvn: null,
            identityNin: null,
            avatarKey: null,
            isActive: false,
            leaveDate: new Date(),
          },
        ),
      ]);
      await this.tenantMemberRepository.softDelete({ userId });
    }

    await Promise.all([
      this.sessionRepository.delete({ userId }),
      this.accountRepository.delete({ userId }),
      this.verificationRepository.delete({ identifier: `email-verification:${userId}` }),
      this.verificationRepository.delete({ identifier: `reset:${userId}` }),
      this.verificationRepository
        .createQueryBuilder()
        .delete()
        .where('identifier LIKE :pattern', { pattern: `otp:%:${userId}` })
        .execute(),
    ]);

    const tombstoneEmail = buildDeletedUserEmail(userId);
    await this.userRepository.update(userId, {
      email: tombstoneEmail,
      password: null,
      isActive: false,
      name: null,
      imageKey: null,
      countryCode: null,
      metadata: null,
    });
    await this.userRepository.softDelete(userId);

    for (const fileKey of fileKeys) {
      try {
        await this.r2Service.deleteFile(fileKey);
      } catch (error) {
        this.logger.warn(
          `Failed to purge file during account deletion: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.USER_DELETED,
        description: `User account deleted`,
        severity: AuditSeverity.HIGH,
        status: AuditStatus.SUCCESS,
        resourceType: 'user',
        resourceId: userId,
        userId,
        metadata: { membershipCount: members.length },
      })
      .catch(() => {});
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.getProfile(userId);
    const members = await this.tenantMemberRepository.find({
      where: { userId },
      relations: ['tenant'],
    });
    const memberIds = members.map((member) => member.id);
    const consent = getUserConsent(user.metadata);

    const [
      employments,
      documents,
      leaves,
      attendances,
      educations,
      emergencyContacts,
      addresses,
      payrollItems,
      paymentMethods,
      notificationPreferences,
      notifications,
    ] =
      memberIds.length > 0
        ? await Promise.all([
            this.employmentRepository.find({ where: { tenantMemberId: In(memberIds) } }),
            this.documentRepository.find({ where: { tenantMemberId: In(memberIds) } }),
            this.leaveRepository.find({ where: { requestedBy: In(memberIds) } }),
            this.attendanceRepository.find({ where: { tenantMemberId: In(memberIds) } }),
            this.educationRepository.find({ where: { tenantMemberId: In(memberIds) } }),
            this.emergencyContactRepository.find({ where: { tenantMemberId: In(memberIds) } }),
            this.addressRepository.find({ where: { tenantMemberId: In(memberIds) } }),
            this.payrollItemRepository.find({ where: { memberId: In(memberIds) } }),
            this.paymentMethodRepository.find({ where: { memberId: In(memberIds) } }),
            this.notificationPreferenceRepository.find({
              where: { tenantMemberId: In(memberIds) },
            }),
            this.notificationRepository.find({ where: { recipientId: In(memberIds) } }),
          ])
        : [[], [], [], [], [], [], [], [], [], [], []];

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        countryCode: user.countryCode,
        consent,
        createdAt: user.createdAt,
      },
      memberships: members.map((member) => ({
        id: member.id,
        tenantId: member.tenantId,
        tenantName: member.tenant?.name,
        role: member.role,
        firstName: member.firstName,
        lastName: member.lastName,
        phone: member.phone,
        dateOfBirth: member.dateOfBirth,
        gender: member.gender,
        identityBvn: this.decryptOptional(member.identityBvn),
        identityNin: this.decryptOptional(member.identityNin),
        joinDate: member.joinDate,
        leaveDate: member.leaveDate,
        isActive: member.isActive,
      })),
      employment: employments.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        tenantId: row.tenantId,
        startDate: row.startDate,
        endDate: row.endDate,
        status: row.status,
        payType: row.payType,
        paySchedule: row.paySchedule,
        payRate: row.payRate,
        currency: row.currency,
        comments: row.comments,
      })),
      documents: documents.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        tenantId: row.tenantId,
        name: row.name,
        type: row.type,
        fileKey: row.fileKey,
        issueDate: row.issueDate,
        expiryDate: row.expiryDate,
        description: row.description,
        isVerified: row.isVerified,
      })),
      leaves: leaves.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        requestedBy: row.requestedBy,
        leaveTypeId: row.leaveTypeId,
        startDate: row.startDate,
        endDate: row.endDate,
        duration: row.duration,
        status: row.status,
        reason: row.reason,
        comments: row.comments,
      })),
      attendance: attendances.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        tenantId: row.tenantId,
        date: row.date,
        clockIn: row.clockIn,
        clockOut: row.clockOut,
        workHours: row.workHours,
        status: row.status,
        notes: row.notes,
      })),
      education: educations.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        tenantId: row.tenantId,
        title: row.title,
        degreeType: row.degreeType,
        institution: row.institution,
        fieldOfStudy: row.fieldOfStudy,
        startDate: row.startDate,
        endDate: row.endDate,
        description: row.description,
        gpa: row.gpa,
      })),
      emergencyContacts: emergencyContacts.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        tenantId: row.tenantId,
        fullName: row.fullName,
        phoneNumber: row.phoneNumber,
        email: row.email,
        relationship: row.relationship,
        address: row.address,
        isPrimary: row.isPrimary,
      })),
      addresses: addresses.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        country: row.country,
        city: row.city,
        state: row.state,
        street: row.street,
        postalCode: row.postalCode,
      })),
      payrollItems: payrollItems.map((row) => ({
        id: row.id,
        memberId: row.memberId,
        payrollRunId: row.payrollRunId,
        status: row.status,
        baseSalary: row.baseSalary,
        baseSalaryCurrency: row.baseSalaryCurrency,
        grossAmount: row.grossAmount,
        adjustments: row.adjustments,
        deductions: row.deductions,
        netAmount: row.netAmount,
        paymentCurrency: row.paymentCurrency,
        paymentAmount: row.paymentAmount,
        exchangeRate: row.exchangeRate,
        paidAt: row.paidAt,
        description: row.description,
      })),
      paymentMethods: paymentMethods.map((row) => ({
        id: row.id,
        memberId: row.memberId,
        tenantId: row.tenantId,
        type: row.type,
        currency: row.currency,
        bankName: row.bankName,
        bankCode: row.bankCode,
        accountName: this.decryptOptional(row.accountName),
        accountNumber: this.decryptOptional(row.accountNumber),
        country: row.country,
        isPrimary: row.isPrimary,
        status: row.status,
        displayName: row.displayName,
      })),
      notificationPreferences: notificationPreferences.map((row) => ({
        id: row.id,
        tenantMemberId: row.tenantMemberId,
        notificationType: row.notificationType,
        preferredChannel: row.preferredChannel,
        isEnabled: row.isEnabled,
        emailEnabled: row.emailEnabled,
        inAppEnabled: row.inAppEnabled,
        quietHoursStart: row.quietHoursStart,
        quietHoursEnd: row.quietHoursEnd,
        quietDays: row.quietDays,
      })),
      notifications: notifications.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        recipientId: row.recipientId,
        type: row.type,
        channel: row.channel,
        priority: row.priority,
        status: row.status,
        title: row.title,
        message: row.message,
        sentAt: row.sentAt,
        deliveredAt: row.deliveredAt,
        readAt: row.readAt,
        expiresAt: row.expiresAt,
      })),
    };

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.DATA_EXPORT,
        description: 'User data export requested',
        severity: AuditSeverity.MEDIUM,
        status: AuditStatus.SUCCESS,
        resourceType: 'user',
        resourceId: userId,
        userId,
        metadata: {
          membershipCount: members.length,
          sections: Object.keys(exportPayload).filter((key) => key !== 'exportedAt'),
        },
      })
      .catch(() => {});

    return exportPayload;
  }

  async getPrivacyConsentStatus(userId: string): Promise<{
    currentVersion: string;
    acceptedVersion: string | null;
    needsReconsent: boolean;
  }> {
    const user = await this.getProfile(userId);
    const currentVersion = getCurrentPrivacyPolicyVersion();
    const acceptedVersion = getUserConsent(user.metadata)?.privacyPolicyVersion ?? null;

    return {
      currentVersion,
      acceptedVersion,
      needsReconsent: needsPrivacyPolicyReconsent(user.metadata),
    };
  }

  async acceptPrivacyPolicy(userId: string): Promise<void> {
    const user = await this.getProfile(userId);
    const consentMetadata = buildUserConsentMetadata(true);
    const metadata = { ...(user.metadata ?? {}), ...consentMetadata };

    await this.userRepository.update(userId, { metadata });

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.USER_UPDATED,
        description: 'Privacy policy re-consent recorded',
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        resourceType: 'user',
        resourceId: userId,
        userId,
        metadata: {
          privacyPolicyVersion: getCurrentPrivacyPolicyVersion(),
        },
      })
      .catch(() => {});
  }

  private decryptOptional(value?: string | null): string | null {
    if (!value?.trim()) {
      return null;
    }
    try {
      return this.encryptionService.decrypt(value);
    } catch {
      return null;
    }
  }

  async getUsers(): Promise<User[]> {
    return this.userRepository.listUsers();
  }

  async getUser(id: string): Promise<User> {
    const user = await this.userRepository.findUser(id);
    if (!user) {
      throw new NotFoundException('User Not found');
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findUserByEmail(email);
  }

  async createUser(data: Partial<User>): Promise<User> {
    return this.userRepository.insertUser(data);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    if (data.email) {
      data.email = StringUtility.trimAndLowerCase(data.email);
    }
    await this.getUser(id);
    await this.userRepository.update(id, data as Parameters<UserRepository['update']>[1]);
    const updated = await this.getUser(id);

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.USER_UPDATED,
        description: `User profile updated`,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        resourceType: 'user',
        resourceId: id,
        userId: id,
        metadata: { updatedFields: Object.keys(data) },
      })
      .catch(() => {});

    return updated;
  }

  validateRegistrationConsent(termsAccepted?: boolean): void {
    if (termsAccepted === false) {
      throw new BadRequestException('You must accept the terms and privacy policy to register');
    }
  }

  buildConsentMetadata(termsAccepted?: boolean) {
    if (termsAccepted === false) {
      throw new BadRequestException('You must accept the terms and privacy policy to register');
    }
    return buildUserConsentMetadata(true);
  }
}
