import { createHash } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import { StringUtility } from 'src/common/utils';
import { In, Repository } from 'typeorm';
import { AuditAction, AuditSeverity, AuditStatus } from '../../../common/enums/audit-action.enum';
import { Address } from '../address/entities/address.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { AuditLogsService } from '../audit-logs/services/audit-logs.service';
import { Account } from '../auth/entities/account.entity';
import { Session } from '../auth/entities/session.entity';
import { Document } from '../document/entities/document.entity';
import { EmergencyContact } from '../emergency-contact/entities/emergency-contact.entity';
import { Employment } from '../employment/entities/employment.entity';
import { PaymentMethod } from '../payment-method/entities/payment-method.entity';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import type { User } from './entities/user.entity';
import { buildUserConsentMetadata, getUserConsent } from './interfaces/user-metadata.interface';
import { UserRepository } from './repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(TenantMember)
    private readonly tenantMemberRepository: Repository<TenantMember>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    @InjectRepository(EmergencyContact)
    private readonly emergencyContactRepository: Repository<EmergencyContact>,
    @InjectRepository(Employment)
    private readonly employmentRepository: Repository<Employment>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly auditLogsService: AuditLogsService,
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

    if (memberIds.length > 0) {
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

      // GDPR Art.17: scrub PII from tenant member before soft-delete and cascade related data
      await this.tenantMemberRepository
        .createQueryBuilder()
        .update(TenantMember)
        .set({
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
          employeeNumber: `anon_${createHash('sha256').update(userId).digest('hex').slice(0, 8)}`,
          isActive: false,
          leaveDate: new Date(),
        })
        .where('user_id = :userId', { userId })
        .execute();

      // Soft-delete/anonymize related personal data
      await this.addressRepository.softDelete({
        tenantMemberId: In(memberIds),
      } as unknown as Record<string, unknown>);
      await this.emergencyContactRepository.delete({
        tenantMemberId: In(memberIds),
      } as unknown as Record<string, unknown>);
      await this.employmentRepository.delete({ tenantMemberId: In(memberIds) } as unknown as Record<
        string,
        unknown
      >);

      // Hard-delete documents metadata (R2 file purge handled separately by retention; we delete rows here)
      if (memberIds.length) {
        await this.documentRepository.delete({ tenantMemberId: In(memberIds) } as unknown as Record<
          string,
          unknown
        >);
      }

      await this.tenantMemberRepository.softDelete({ userId });
    }

    await Promise.all([
      this.sessionRepository.delete({ userId }),
      this.accountRepository.delete({ userId }),
    ]);

    const tombstoneEmail = `deleted_${createHash('sha256').update(userId).digest('hex').slice(0, 16)}@anonymized.paqad.local`;
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
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        middleName: true,
        preferredName: true,
        phone: true,
        dateOfBirth: true,
        gender: true,
        role: true,
        isActive: true,
        employeeNumber: true,
        joinDate: true,
        leaveDate: true,
        createdAt: true,
      } as unknown as Record<string, boolean>,
    });

    const consent = getUserConsent(user.metadata);
    const memberIds = members.map((m) => m.id);

    const [addresses, emergencyContacts, employments, documents, paymentMethods, auditLogs] =
      await Promise.all([
        memberIds.length
          ? this.addressRepository.find({
              where: { tenantMemberId: In(memberIds) } as unknown as Record<string, unknown>,
              select: [
                'id',
                'country',
                'city',
                'state',
                'street',
                'postalCode',
                'tenantMemberId',
              ] as unknown as string[],
            })
          : Promise.resolve([]),
        memberIds.length
          ? this.emergencyContactRepository.find({
              where: { tenantMemberId: In(memberIds) } as unknown as Record<string, unknown>,
            })
          : Promise.resolve([]),
        memberIds.length
          ? this.employmentRepository.find({
              where: { tenantMemberId: In(memberIds) } as unknown as Record<string, unknown>,
              select: [
                'id',
                'tenantId',
                'tenantMemberId',
                'startDate',
                'endDate',
                'status',
                'payType',
                'paySchedule',
                'payRate',
                'currency',
              ] as unknown as string[],
            })
          : Promise.resolve([]),
        memberIds.length
          ? this.documentRepository.find({
              where: { tenantMemberId: In(memberIds) } as unknown as Record<string, unknown>,
              select: [
                'id',
                'name',
                'type',
                'fileKey',
                'tenantId',
                'tenantMemberId',
                'createdAt',
              ] as unknown as string[],
            })
          : Promise.resolve([]),
        memberIds.length
          ? this.paymentMethodRepository.find({
              where: { memberId: In(memberIds) } as unknown as Record<string, unknown>,
              select: [
                'id',
                'memberId',
                'tenantId',
                'bankName',
                'accountNumber',
                'currency',
                'status',
              ] as unknown as string[],
            })
          : Promise.resolve([]),
        this.auditLogRepository.find({
          where: { userId },
          order: { createdAt: 'DESC' as unknown as never },
          take: 200,
        }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        countryCode: user.countryCode,
        consent,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      memberships: members.map((member) => ({
        id: member.id,
        tenantId: member.tenantId,
        tenantName: (member as unknown as { tenant?: { name: string } }).tenant?.name,
        role: member.role,
        firstName: member.firstName,
        lastName: member.lastName,
        middleName: (member as unknown as { middleName: string | null }).middleName,
        preferredName: (member as unknown as { preferredName: string | null }).preferredName,
        phone: member.phone,
        dateOfBirth: member.dateOfBirth,
        gender: member.gender,
        employeeNumber: (member as unknown as { employeeNumber: string }).employeeNumber,
        joinDate: (member as unknown as { joinDate: Date }).joinDate,
        leaveDate: (member as unknown as { leaveDate: Date }).leaveDate,
      })),
      addresses: addresses.map((a) => ({
        id: a.id,
        tenantMemberId: a.tenantMemberId,
        country: a.country,
        city: a.city,
        state: a.state,
        street: a.street,
        postalCode: a.postalCode,
      })),
      emergencyContacts: emergencyContacts.map((c) => ({
        id: c.id,
        tenantMemberId: c.tenantMemberId,
        fullName: c.fullName,
        phoneNumber: c.phoneNumber,
        email: c.email,
        relationship: c.relationship,
      })),
      employments: employments.map((e) => ({
        id: e.id,
        tenantMemberId: e.tenantMemberId,
        tenantId: e.tenantId,
        startDate: e.startDate,
        endDate: e.endDate,
        status: e.status,
        payType: e.payType,
        paySchedule: e.paySchedule,
        payRate: e.payRate,
        currency: e.currency,
      })),
      documents: documents.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        tenantMemberId: d.tenantMemberId,
        tenantId: d.tenantId,
        createdAt: d.createdAt,
      })),
      paymentMethods: paymentMethods.map((p) => ({
        id: p.id,
        memberId: p.memberId,
        tenantId: p.tenantId,
        bankName: p.bankName,
        last4: p.accountNumber ? `****${String(p.accountNumber).slice(-4)}` : null,
        currency: p.currency,
        status: p.status,
      })),
      auditLogs: auditLogs.map((l) => ({
        id: l.id,
        action: l.action,
        description: l.description,
        createdAt: l.createdAt,
      })),
      notice:
        'Art.15/20 GDPR export — includes all personal data held for this account across tenants',
    };
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
    if (termsAccepted !== true) {
      throw new BadRequestException('You must accept the terms and privacy policy to register');
    }
  }

  buildConsentMetadata(termsAccepted?: boolean, privacyPolicyVersion?: string) {
    if (termsAccepted !== true) {
      throw new BadRequestException('You must accept the terms and privacy policy to register');
    }
    return buildUserConsentMetadata(true, privacyPolicyVersion);
  }
}
