import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { isReservedTenantSlug } from 'src/common/constants/reserved-tenant-slugs';
import { TenantMemberRole } from 'src/common/enums';
import { StringUtility } from 'src/common/utils';
import { DataSource } from 'typeorm';
import { AuditAction, AuditSeverity, AuditStatus } from '../../../../common/enums/audit-action.enum';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';
import { TenantCreatedEvent, TenantMemberCreatedEvent } from '../../leave/events/leave.events';
import { TenantCounter } from '../../tenant-members/entities/tenant-counter.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantSettings } from '../../tenant-settings/entities/tenant-settings.entity';
import { UsersService } from '../../users/users.service';
import type { CreateTenantDto } from '../dto/create-tenant.dto';
import { Tenant } from '../entities/tenant.entity';
import { TenantRepository } from '../repositories/tenant.repository';

@Injectable()
export class TenantInviteService {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly userService: UsersService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogsService: AuditLogsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createTenant(creatorId: string, data: CreateTenantDto): Promise<Tenant> {
    try {
      const user = await this.userService.getUser(creatorId);
      if (!user) {
        throw new UnprocessableEntityException('User not found');
      }
      const slug = await this.resolveSlug(data.slug, data.name);
      if (isReservedTenantSlug(slug)) {
        throw new UnprocessableEntityException(
          `The subdomain "${slug}" is reserved and cannot be used.`,
        );
      }
      const inviteCode = StringUtility.generateInviteCode();
      const employeeCode = this.generateEmployeeCode(data.name);

      const { savedTenant, tenantMember } = await this.dataSource.transaction(async (manager) => {
        const tenantRepo = manager.getRepository(Tenant);
        const memberRepo = manager.getRepository(TenantMember);
        const counterRepo = manager.getRepository(TenantCounter);
        const settingsRepo = manager.getRepository(TenantSettings);

        const tenantEntity = tenantRepo.create({
          name: data.name,
          slug,
          createdBy: user,
          isActive: true,
          inviteCode,
          employeeCode,
          industry: data.industry || null,
          companySize: data.companySize || null,
          location: data.location || null,
        });
        const savedTenant = await tenantRepo.save(tenantEntity);

        const existingMember = await memberRepo.findOne({
          where: { userId: creatorId, tenantId: savedTenant.id },
        });
        if (existingMember) {
          throw new BadRequestException('User is already a member of this tenant');
        }

        let numberPrefix = '';
        let numberPadding = 3;
        try {
          const settings = await settingsRepo.findOne({
            where: { tenantId: savedTenant.id },
          });
          if (settings?.settings?.employee) {
            numberPrefix = settings.settings.employee.numberPrefix || '';
            numberPadding = settings.settings.employee.numberPadding || 3;
          }
        } catch (_) {}

        let counter = await counterRepo.findOne({
          where: { tenantId: savedTenant.id, counterType: 'employee_number' },
        });
        if (!counter) {
          counter = counterRepo.create({
            tenantId: savedTenant.id,
            counterType: 'employee_number',
            currentValue: 0,
            prefix: numberPrefix,
            paddingLength: numberPadding,
          });
        } else {
          counter.currentValue = (counter.currentValue || 0) + 1;
        }
        await counterRepo.save(counter);
        const employeeNumber = (counter.currentValue || 0).toString().padStart(numberPadding, '0');

        const memberEntity = memberRepo.create({
          userId: creatorId,
          tenantId: savedTenant.id,
          role: TenantMemberRole.OWNER,
          isActive: true,
          joinDate: new Date(),
          employeeNumber,
          firstName: null,
          lastName: null,
          preferredName: null,
        });
        const tenantMember = await memberRepo.save(memberEntity);

        return { savedTenant, tenantMember };
      });

      try {
        this.eventEmitter.emit(
          'tenant.created',
          new TenantCreatedEvent(savedTenant.id, tenantMember.id, savedTenant),
        );
        this.eventEmitter.emit(
          'tenant.member.created',
          new TenantMemberCreatedEvent(savedTenant.id, tenantMember.id, tenantMember.joinDate),
        );
        this.eventEmitter.emit('tenant.settings.initialize', {
          tenantId: savedTenant.id,
          companyName: data.name,
          employeeCode,
          defaultSettings: {
            general: {
              companyName: data.name,
            },
            attendance: {
              weekends: [0, 6],
            },
          },
        });
      } catch (_eventError) {}

      void this.auditLogsService
        .queueAuditLog({
          action: AuditAction.TENANT_CREATED,
          description: `Workspace "${data.name}" created`,
          severity: AuditSeverity.MEDIUM,
          status: AuditStatus.SUCCESS,
          resourceType: 'tenant',
          resourceId: savedTenant.id,
          userId: creatorId,
          metadata: { name: data.name, slug },
        })
        .catch(() => {});

      return savedTenant;
    } catch (error) {
      if (error instanceof UnprocessableEntityException || error instanceof BadRequestException) {
        throw error;
      }
      throw new UnprocessableEntityException('Failed to create tenant. Please try again.');
    }
  }

  async getTenantByInviteCode(inviteCode: string): Promise<Tenant | null> {
    return this.tenantRepository.findByInviteCode(inviteCode);
  }

  private async resolveSlug(rawSlug: string | undefined, name: string): Promise<string> {
    if (rawSlug?.trim()) {
      const slug = StringUtility.slugify(rawSlug.trim());
      const existing = await this.tenantRepository.findBySlug(slug);
      if (existing) {
        throw new UnprocessableEntityException('This workspace slug is already taken.');
      }
      return slug;
    }
    return this.generateSlug(name);
  }

  private async generateSlug(slug: string): Promise<string> {
    const baseSlug = StringUtility.slugify(slug);
    const existingSlugs = await this.tenantRepository.findSlugsStartingWith(baseSlug);
    if (!existingSlugs.length) {
      return baseSlug;
    }
    const numbers = existingSlugs
      .map((slug) => slug.replace(`${baseSlug}-`, ''))
      .map((num) => parseInt(num, 10))
      .filter((num) => !Number.isNaN(num))
      .sort((a, b) => a - b);
    const nextNumber = numbers.length ? numbers[numbers.length - 1] + 1 : 1;
    return `${baseSlug}-${nextNumber}`;
  }

  private generateEmployeeCode(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 3).toLowerCase();
    }
    if (parts.length === 2) {
      return (parts[0][0] + parts[1][0]).toLowerCase();
    }
    return parts
      .slice(0, 3)
      .map((word) => word[0])
      .join('')
      .toLowerCase();
  }
}
