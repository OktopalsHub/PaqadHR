import { createHash } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import { StringUtility } from 'src/common/utils';
import { Repository } from 'typeorm';
import { AuditAction, AuditSeverity, AuditStatus } from '../../../common/enums/audit-action.enum';
import { AuditLogsService } from '../audit-logs/services/audit-logs.service';
import { Account } from '../auth/entities/account.entity';
import { Session } from '../auth/entities/session.entity';
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

      await this.tenantMemberRepository.update(
        { userId },
        { isActive: false, leaveDate: new Date() },
      );
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
    });

    const consent = getUserConsent(user.metadata);

    return {
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
      })),
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
