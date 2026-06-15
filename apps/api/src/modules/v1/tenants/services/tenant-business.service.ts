import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantMemberRole } from 'src/common/enums';
import { StringUtility } from 'src/common/utils';
import { TenantCreatedEvent, TenantMemberCreatedEvent } from '../../leave/events/leave.events';
import type { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import type { CreateTenantDto } from '../dto/create-tenant.dto';
import type { Tenant } from '../entities/tenant.entity';
import { TenantRepository } from '../repositories/tenant.repository';

@Injectable()
export class TenantBusinessService {
  private readonly logger = new Logger(TenantBusinessService.name);
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly tenantMemberService: TenantMembersService,
    private readonly userService: UsersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  async createTenantWithOwner(
    creatorId: string,
    data: CreateTenantDto,
  ): Promise<{ tenant: Tenant; member: unknown }> {
    try {
      const user = await this.userService.getUser(creatorId);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      const slug = await this.generateUniqueSlug(data.name);
      this.validateSlugNotReserved(slug);
      const tenant = await this.createTenant(user, data, slug);
      const member = await this.createOwnerMembership(creatorId, tenant.id);
      await this.emitTenantCreationEvents(tenant, member);
      await this.initializeTenantSettings(tenant, data.name);
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
    if ((process.env.TENANT_EXCLUDED_SUBDOMAINS ?? '').includes(slug.toLowerCase())) {
      throw new BadRequestException(`The subdomain "${slug}" is reserved and cannot be used.`);
    }
  }
  private async createTenant(user: User, data: CreateTenantDto, slug: string): Promise<Tenant> {
    const inviteCode = StringUtility.generateInviteCode();
    const employeeCode = this.generateEmployeeCode(data.name);
    const tenantData: Partial<Tenant> = {
      name: data.name,
      slug,
      createdBy: user as Tenant['createdBy'],
      isActive: true,
      inviteCode,
      employeeCode,
      industry: data.industry || null,
      companySize: data.companySize || null,
      location: data.location || null,
    };
    return this.tenantRepository.create(tenantData);
  }
  private async createOwnerMembership(userId: string, tenantId: string): Promise<TenantMember> {
    return this.tenantMemberService.createTenantMember(userId, tenantId, {
      role: TenantMemberRole.OWNER,
    });
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
