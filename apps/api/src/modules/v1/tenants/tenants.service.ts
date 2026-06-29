import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantMemberRole } from 'src/common/enums';
import { FileUrlService } from 'src/common/services/file-url.service';
import { StringUtility } from 'src/common/utils';
import { TenantCreatedEvent, TenantMemberCreatedEvent } from '../leave/events/leave.events';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import { UsersService } from '../users/users.service';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { UpdateTenantDto } from './dto/update-tenant.dto';
import type { Tenant } from './entities/tenant.entity';
import { TenantRepository } from './repositories/tenant.repository';

@Injectable()
export class TenantsService {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly tenantMemberService: TenantMembersService,
    private readonly userService: UsersService,
    private readonly eventEmitter: EventEmitter2,
    readonly _fileUrlService: FileUrlService,
  ) {}
  async createTenant(creatorId: string, data: CreateTenantDto): Promise<Tenant> {
    try {
      const user = await this.userService.getUser(creatorId);
      if (!user) {
        throw new UnprocessableEntityException('User not found');
      }
      const slug = await this.resolveSlug(data.slug, data.name);
      const excluded = process.env.TENANT_EXCLUDED_SUBDOMAINS || process.env.EXCLUDED_SUBDOMAINS || '';
      if (excluded.includes(slug.toLowerCase())) {
        throw new UnprocessableEntityException(
          `The subdomain "${slug}" is reserved and cannot be used.`,
        );
      }
      const inviteCode = StringUtility.generateInviteCode();
      const employeeCode = this.generateEmployeeCode(data.name);
      const tenantData: Partial<Tenant> = {
        name: data.name,
        slug,
        createdBy: user,
        isActive: true,
        inviteCode,
        employeeCode,
        industry: data.industry || null,
        companySize: data.companySize || null,
        location: data.location || null,
      };
      const savedTenant = await this.tenantRepository.create(tenantData);
      const tenantMember = await this.tenantMemberService.createTenantMember(
        creatorId,
        savedTenant.id,
        {
          role: TenantMemberRole.OWNER,
        },
      );
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
      return savedTenant;
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }
      throw new UnprocessableEntityException('Failed to create tenant. Please try again.');
    }
  }
  async listTenants(includeDeleted: boolean = false): Promise<Tenant[]> {
    return this.tenantRepository.find({ withDeleted: includeDeleted });
  }
  async getTenant(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }
  async getUserTenants(userId: string): Promise<Tenant[]> {
    const memberships = await this.tenantMemberService.getUserMemberships(userId);
    const tenantIds = memberships?.map((member) => member.tenantId);
    if (!tenantIds?.length) {
      return [];
    }
    return this.tenantRepository.getTenantByIds(tenantIds);
  }
  async getUserTenantsWithDetails(userId: string) {
    const memberships = await this.tenantMemberService.getUserMemberships(userId);
    if (!memberships?.length) {
      return {
        tenants: [],
        totalCount: 0,
      };
    }
    const tenantIds = memberships.map((member) => member.tenantId);
    const tenants = await this.tenantRepository.getTenantByIds(tenantIds);
    const membershipMap = new Map(memberships.map((m) => [m.tenantId, m]));
    const tenantsWithMembership = tenants.map((tenant) => ({
      ...tenant,
      membership: membershipMap.get(tenant.id),
    }));
    return {
      tenants: tenantsWithMembership,
      totalCount: tenants.length,
    };
  }
  async getTenantMembers(tenantId: string): Promise<unknown[]> {
    return this.tenantMemberService.getTenantMembers(tenantId);
  }
  async updateTenant(tenantId: string, updateTenantDto: UpdateTenantDto): Promise<Tenant | null> {
    const existingTenant = await this.tenantRepository.findById(tenantId);
    if (!existingTenant) {
      throw new NotFoundException('Tenant does not exist');
    }
    if (updateTenantDto.name) {
      existingTenant.name = updateTenantDto.name;
    }
    if (updateTenantDto.logoKey) {
      existingTenant.logoKey = updateTenantDto.logoKey;
    }
    if (updateTenantDto.slug) {
      const incomingSlug = StringUtility.slugify(updateTenantDto.slug);
      const currentSlug = StringUtility.slugify(existingTenant.slug);
      if (incomingSlug !== currentSlug) {
        const tenantWithSlug = await this.tenantRepository.findBySlug(incomingSlug);
        if (tenantWithSlug && tenantWithSlug.id !== tenantId) {
          throw new UnprocessableEntityException('Slug already exists');
        }
        updateTenantDto.slug = incomingSlug;
      } else {
        updateTenantDto.slug = currentSlug;
      }
    } else {
      updateTenantDto.slug = existingTenant.slug;
    }
    await this.tenantRepository.update(tenantId, updateTenantDto);
    return this.tenantRepository.findOne({ where: { id: tenantId } });
  }
  async permanentDeleteTenant(tenantId: string): Promise<void> {
    const result = await this.tenantRepository.delete(tenantId);
    if (result.affected === 0) {
      throw new NotFoundException(`Tenant not found`);
    }
  }
  async deleteTenant(tenantId: string): Promise<void> {
    const result = await this.tenantRepository.softDelete(tenantId);
    if (result.affected === 0) {
      throw new NotFoundException(`Tenant not found`);
    }
  }
  async restoreTenant(tenantId: string): Promise<void> {
    const result = await this.tenantRepository.restore(tenantId);
    if (result.affected === 0) {
      throw new NotFoundException(`Tenant not found`);
    }
  }
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantRepository.findBySlug(slug);
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
