import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { isReservedTenantSlug } from 'src/common/constants/reserved-tenant-slugs';
import { TenantMemberRole } from 'src/common/enums';
import { FileUrlService } from 'src/common/services/file-url.service';
import { StringUtility } from 'src/common/utils';
import { isWalletCurrencyLocked } from 'src/common/utils/rewards-defaults.util';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AuditAction, AuditSeverity, AuditStatus } from '../../../common/enums/audit-action.enum';
import { AuditLogsService } from '../audit-logs/services/audit-logs.service';
import type { SessionWorkspaceDto } from '../auth/dto/session-bootstrap-response.dto';
import { Employment } from '../employment/entities/employment.entity';
import { TenantCreatedEvent, TenantMemberCreatedEvent } from '../leave/events/leave.events';
import { TenantWallet } from '../rewards/entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../rewards/entities/tenant-wallet-transaction.entity';
import { SubscriptionsService } from '../subscriptions/services/subscriptions.service';
import { TenantCounter } from '../tenant-members/entities/tenant-counter.entity';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import { TenantSettings } from '../tenant-settings/entities/tenant-settings.entity';
import { UsersService } from '../users/users.service';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { UpdateTenantDto } from './dto/update-tenant.dto';
import { Tenant } from './entities/tenant.entity';
import { TenantRepository } from './repositories/tenant.repository';

@Injectable()
export class TenantsService {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly tenantMemberService: TenantMembersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly userService: UsersService,
    private readonly eventEmitter: EventEmitter2,
    readonly _fileUrlService: FileUrlService,
    @InjectRepository(Employment)
    private readonly employmentRepository: Repository<Employment>,
    @InjectRepository(TenantWallet)
    private readonly walletRepository: Repository<TenantWallet>,
    @InjectRepository(TenantWalletTransaction)
    private readonly walletTransactionRepository: Repository<TenantWalletTransaction>,
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

  async getSessionWorkspaces(userId: string): Promise<SessionWorkspaceDto[]> {
    const memberships = await this.tenantMemberService.getActiveMembershipSummaries(userId);
    if (!memberships.length) {
      return [];
    }

    const tenantIds = memberships.map((member) => member.tenantId);
    const [tenants, entitlements] = await Promise.all([
      this.tenantRepository.getTenantByIds(tenantIds),
      this.subscriptionsService.getEntitlementsForTenants(tenantIds),
    ]);
    const membershipMap = new Map(memberships.map((member) => [member.tenantId, member]));
    const workspaces: SessionWorkspaceDto[] = [];

    for (const tenant of tenants) {
      const member = membershipMap.get(tenant.id);
      if (!member) continue;

      const entitlement = entitlements.get(tenant.id) ?? {
        entitled: false,
        needsPayment: true,
        plan: null,
      };

      workspaces.push({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        isActive: tenant.isActive,
        logoUrl:
          tenant.logoKey && tenant.id
            ? this._fileUrlService.getTenantLogoUrl(tenant.id, tenant.logoKey) || undefined
            : undefined,
        timezone: tenant.timezone,
        preferredCurrency: tenant.preferredCurrency || undefined,
        countryCode: tenant.countryCode || undefined,
        member: {
          id: member.id,
          role: member.role,
          isActive: member.isActive,
        },
        entitled: entitlement.entitled,
        needsPayment: entitlement.needsPayment,
        plan: entitlement.plan,
      });
    }

    return workspaces;
  }
  async getTenantMembers(tenantId: string): Promise<unknown[]> {
    return this.tenantMemberService.getTenantMembers(tenantId);
  }
  async updateTenant(tenantId: string, updateTenantDto: UpdateTenantDto): Promise<Tenant | null> {
    const existingTenant = await this.tenantRepository.findById(tenantId);
    if (!existingTenant) {
      throw new NotFoundException('Tenant does not exist');
    }
    await this.assertRewardsWalletAllowsTenantProfileChange(
      tenantId,
      existingTenant,
      updateTenantDto,
    );
    if (updateTenantDto.preferredCurrency) {
      const next = updateTenantDto.preferredCurrency.toUpperCase();
      updateTenantDto.preferredCurrency = next;
      const current = (existingTenant.preferredCurrency || 'USD').toUpperCase();
      if (next !== current) {
        const stillOnOld = await this.employmentRepository.count({
          where: {
            tenantId,
            endDate: IsNull(),
            currency: current,
          },
        });
        if (stillOnOld > 0) {
          throw new BadRequestException(
            `${stillOnOld} employee salary record(s) are still in ${current}. Update those salaries to ${next} (or another currency) before changing the workspace currency.`,
          );
        }
        updateTenantDto.preferredCurrency = next;
      }
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
        if (isReservedTenantSlug(incomingSlug)) {
          throw new UnprocessableEntityException(
            `The subdomain "${incomingSlug}" is reserved and cannot be used.`,
          );
        }
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

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.TENANT_UPDATED,
        description: `Workspace settings updated`,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        resourceType: 'tenant',
        resourceId: tenantId,
        metadata: { updatedFields: Object.keys(updateTenantDto) },
      })
      .catch(() => {});

    return this.tenantRepository.findOne({ where: { id: tenantId } });
  }
  async permanentDeleteTenant(tenantId: string): Promise<void> {
    const result = await this.tenantRepository.delete(tenantId);
    if (result.affected === 0) {
      throw new NotFoundException(`Tenant not found`);
    }

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.TENANT_DELETED,
        description: `Workspace permanently deleted`,
        severity: AuditSeverity.CRITICAL,
        status: AuditStatus.SUCCESS,
        resourceType: 'tenant',
        resourceId: tenantId,
      })
      .catch(() => {});
  }
  async deleteTenant(tenantId: string): Promise<void> {
    const result = await this.tenantRepository.softDelete(tenantId);
    if (result.affected === 0) {
      throw new NotFoundException(`Tenant not found`);
    }

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.TENANT_DELETED,
        description: `Workspace soft-deleted`,
        severity: AuditSeverity.HIGH,
        status: AuditStatus.SUCCESS,
        resourceType: 'tenant',
        resourceId: tenantId,
      })
      .catch(() => {});
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

  private async assertRewardsWalletAllowsTenantProfileChange(
    tenantId: string,
    existingTenant: Tenant,
    updateTenantDto: UpdateTenantDto,
  ): Promise<void> {
    const wallet = await this.walletRepository.findOne({ where: { tenantId } });
    if (!wallet) {
      return;
    }

    const transactionCount = await this.walletTransactionRepository.count({
      where: { tenantWalletId: wallet.id },
    });
    if (!isWalletCurrencyLocked(wallet, transactionCount)) {
      return;
    }

    const currentCurrency = (existingTenant.preferredCurrency || 'USD').toUpperCase();
    const nextCurrency = updateTenantDto.preferredCurrency?.toUpperCase();
    const currencyChanging = Boolean(nextCurrency && nextCurrency !== currentCurrency);

    if (currencyChanging) {
      throw new BadRequestException(
        `Rewards wallet has activity in ${wallet.currencyCode.toUpperCase()}. Spend the balance before changing workspace currency.`,
      );
    }
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
