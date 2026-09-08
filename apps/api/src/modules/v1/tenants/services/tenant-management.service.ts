import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isReservedTenantSlug } from 'src/common/constants/reserved-tenant-slugs';
import { FileUrlService } from 'src/common/services/file-url.service';
import { StringUtility } from 'src/common/utils';
import { isWalletCurrencyLocked } from 'src/common/utils/rewards-defaults.util';
import { IsNull, Repository } from 'typeorm';
import { AuditAction, AuditSeverity, AuditStatus } from '../../../../common/enums/audit-action.enum';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';
import type { SessionWorkspaceDto } from '../../auth/dto/session-bootstrap-response.dto';
import { Employment } from '../../employment/entities/employment.entity';
import { TenantWallet } from '../../rewards/entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../../rewards/entities/tenant-wallet-transaction.entity';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import type { UpdateTenantDto } from '../dto/update-tenant.dto';
import { Tenant } from '../entities/tenant.entity';
import { TenantRepository } from '../repositories/tenant.repository';

@Injectable()
export class TenantManagementService {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly tenantMemberService: TenantMembersService,
    private readonly subscriptionsService: SubscriptionsService,
    readonly _fileUrlService: FileUrlService,
    private readonly auditLogsService: AuditLogsService,
    @InjectRepository(Employment)
    private readonly employmentRepository: Repository<Employment>,
    @InjectRepository(TenantWallet)
    private readonly walletRepository: Repository<TenantWallet>,
    @InjectRepository(TenantWalletTransaction)
    private readonly walletTransactionRepository: Repository<TenantWalletTransaction>,
  ) {}

  async listTenants(includeDeleted = false): Promise<Tenant[]> {
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
}
