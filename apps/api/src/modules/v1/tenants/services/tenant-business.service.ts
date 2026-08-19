import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { isReservedTenantSlug } from 'src/common/constants/reserved-tenant-slugs';
import { TenantMemberRole } from 'src/common/enums';
import { StringUtility } from 'src/common/utils';
import { DataSource } from 'typeorm';
import { TenantCreatedEvent, TenantMemberCreatedEvent } from '../../leave/events/leave.events';
import { TenantCounter } from '../../tenant-members/entities/tenant-counter.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantSettings } from '../../tenant-settings/entities/tenant-settings.entity';
import { UsersService } from '../../users/users.service';
import type { CreateTenantDto } from '../dto/create-tenant.dto';
import { Tenant } from '../entities/tenant.entity';
import { TenantRepository } from '../repositories/tenant.repository';

@Injectable()
export class TenantBusinessService {
  private readonly logger = new Logger(TenantBusinessService.name);
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly userService: UsersService,
    private readonly eventEmitter: EventEmitter2,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}
  async createTenantWithOwner(
    creatorId: string,
    data: CreateTenantDto,
  ): Promise<{ tenant: Tenant; member: TenantMember }> {
    try {
      const user = await this.userService.getUser(creatorId);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      const slug = await this.generateUniqueSlug(data.name);
      this.validateSlugNotReserved(slug);

      const { tenant, member } = await this.dataSource.transaction(async (manager) => {
        const tenantRepo = manager.getRepository(Tenant);
        const memberRepo = manager.getRepository(TenantMember);
        const counterRepo = manager.getRepository(TenantCounter);
        const settingsRepo = manager.getRepository(TenantSettings);

        const inviteCode = StringUtility.generateInviteCode();
        const employeeCode = this.generateEmployeeCode(data.name);
        const tenantEntity = tenantRepo.create({
          name: data.name,
          slug,
          createdBy: user as Tenant['createdBy'],
          isActive: true,
          inviteCode,
          employeeCode,
          industry: data.industry || null,
          companySize: data.companySize || null,
          location: data.location || null,
        });
        const tenant = await tenantRepo.save(tenantEntity);

        const existingMember = await memberRepo.findOne({
          where: { userId: creatorId, tenantId: tenant.id },
        });
        if (existingMember) {
          throw new BadRequestException('User is already a member of this tenant');
        }

        let numberPrefix = '';
        let numberPadding = 3;
        try {
          const settings = await settingsRepo.findOne({
            where: { tenantId: tenant.id },
          });
          if (settings?.settings?.employee) {
            numberPrefix = settings.settings.employee.numberPrefix || '';
            numberPadding = settings.settings.employee.numberPadding || 3;
          }
        } catch (_) {}

        let counter = await counterRepo.findOne({
          where: { tenantId: tenant.id, counterType: 'employee_number' },
        });
        if (!counter) {
          counter = counterRepo.create({
            tenantId: tenant.id,
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
          tenantId: tenant.id,
          role: TenantMemberRole.OWNER,
          isActive: true,
          joinDate: new Date(),
          employeeNumber,
        });
        const member = await memberRepo.save(memberEntity);

        return { tenant, member };
      });

      this.emitTenantCreationEvents(tenant, member);
      this.initializeTenantSettings(tenant, data.name);

      return { tenant, member };
    } catch (error) {
      this.logger.error('Error in tenant creation business logic:', error);
      throw error;
    }
  }
  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = StringUtility.slugify(name);
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
  private validateSlugNotReserved(slug: string): void {
    if (isReservedTenantSlug(slug)) {
      throw new BadRequestException(`The subdomain "${slug}" is reserved and cannot be used.`);
    }
  }
  private emitTenantCreationEvents(tenant: Tenant, member: TenantMember): void {
    try {
      this.eventEmitter.emit(
        'tenant.created',
        new TenantCreatedEvent(tenant.id, member.id, tenant),
      );
      this.eventEmitter.emit(
        'tenant.member.created',
        new TenantMemberCreatedEvent(tenant.id, member.id, member.joinDate),
      );
    } catch (error) {
      this.logger.error('Error emitting tenant creation events:', error);
    }
  }
  private initializeTenantSettings(tenant: Tenant, companyName: string): void {
    try {
      this.eventEmitter.emit('tenant.settings.initialize', {
        tenantId: tenant.id,
        companyName,
        employeeCode: tenant.employeeCode,
        defaultSettings: {
          general: { companyName },
          attendance: { weekends: [0, 6] },
        },
      });
    } catch (error) {
      this.logger.error('Error initializing tenant settings:', error);
    }
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
