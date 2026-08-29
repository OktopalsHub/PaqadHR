import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CloudflareR2Service } from 'src/common/services/cloudflare-r2.service';
import { StringUtility } from 'src/common/utils';
import { DataSource } from 'typeorm';
import { AuditAction, AuditSeverity, AuditStatus } from '../../../common/enums/audit-action.enum';
import { AuditLogsService } from '../audit-logs/services/audit-logs.service';
import { Account } from '../auth/entities/account.entity';
import { Session } from '../auth/entities/session.entity';
import { Verification } from '../auth/entities/verification.entity';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import { User } from './entities/user.entity';
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
    private readonly tenantMembersService: TenantMembersService,
    private readonly dataSource: DataSource,
    private readonly auditLogsService: AuditLogsService,
    private readonly r2Service: CloudflareR2Service,
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

    const fileKeys = new Set<string>();
    if (user.imageKey) {
      fileKeys.add(user.imageKey);
    }

    let membershipCount = 0;

    await this.dataSource.transaction(async (manager) => {
      const scrubResult = await this.tenantMembersService.scrubPersonalData(userId, manager);
      membershipCount = scrubResult.membershipCount;
      for (const key of scrubResult.fileKeys) {
        fileKeys.add(key);
      }

      await Promise.all([
        manager.getRepository(Session).delete({ userId }),
        manager.getRepository(Account).delete({ userId }),
        manager.getRepository(Verification).delete({ identifier: `email-verification:${userId}` }),
        manager.getRepository(Verification).delete({ identifier: `reset:${userId}` }),
        manager
          .getRepository(Verification)
          .createQueryBuilder()
          .delete()
          .where('identifier LIKE :pattern', { pattern: `otp:%:${userId}` })
          .execute(),
      ]);

      const tombstoneEmail = buildDeletedUserEmail(userId);
      const userRepo = manager.getRepository(User);
      await userRepo.update(userId, {
        email: tombstoneEmail,
        password: null,
        isActive: false,
        name: null,
        imageKey: null,
        countryCode: null,
        metadata: null,
      });
      await userRepo.softDelete(userId);
    });

    const failedFileKeys: string[] = [];
    for (const fileKey of fileKeys) {
      try {
        await this.r2Service.deleteFile(fileKey);
      } catch {
        try {
          await this.r2Service.deleteFile(fileKey);
        } catch (error) {
          failedFileKeys.push(fileKey);
          this.logger.error(
            `Failed to purge file during account deletion after retry: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.USER_DELETED,
        description:
          failedFileKeys.length > 0
            ? 'User account deleted with incomplete file purge'
            : 'User account deleted',
        severity: AuditSeverity.HIGH,
        status: failedFileKeys.length > 0 ? AuditStatus.FAILED : AuditStatus.SUCCESS,
        resourceType: 'user',
        resourceId: userId,
        userId,
        metadata: {
          membershipCount,
          ...(failedFileKeys.length > 0 ? { failedFileKeys } : {}),
        },
      })
      .catch(() => {});
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.getProfile(userId);
    const consent = getUserConsent(user.metadata);
    const memberExport = await this.tenantMembersService.loadPersonalDataForExport(userId);

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
      ...memberExport,
    };

    const memberships = (memberExport.memberships as unknown[]) ?? [];

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
          membershipCount: memberships.length,
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
