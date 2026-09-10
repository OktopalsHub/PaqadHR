import { Injectable } from '@nestjs/common';
import type { SessionWorkspaceDto } from '../auth/dto/session-bootstrap-response.dto';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { UpdateTenantDto } from './dto/update-tenant.dto';
import { Tenant } from './entities/tenant.entity';
import { TenantInviteService } from './services/tenant-invite.service';
import { TenantManagementService } from './services/tenant-management.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly tenantInviteService: TenantInviteService,
    private readonly tenantManagementService: TenantManagementService,
  ) {}

  async createTenant(creatorId: string, data: CreateTenantDto): Promise<Tenant> {
    return this.tenantInviteService.createTenant(creatorId, data);
  }

  async listTenants(includeDeleted = false): Promise<Tenant[]> {
    return this.tenantManagementService.listTenants(includeDeleted);
  }

  async getTenant(tenantId: string): Promise<Tenant> {
    return this.tenantManagementService.getTenant(tenantId);
  }

  async getUserTenants(userId: string): Promise<Tenant[]> {
    return this.tenantManagementService.getUserTenants(userId);
  }

  async getUserTenantsWithDetails(userId: string) {
    return this.tenantManagementService.getUserTenantsWithDetails(userId);
  }

  async getSessionWorkspaces(userId: string): Promise<SessionWorkspaceDto[]> {
    return this.tenantManagementService.getSessionWorkspaces(userId);
  }

  async getTenantMembers(tenantId: string): Promise<unknown[]> {
    return this.tenantManagementService.getTenantMembers(tenantId);
  }

  async updateTenant(tenantId: string, updateTenantDto: UpdateTenantDto): Promise<Tenant | null> {
    return this.tenantManagementService.updateTenant(tenantId, updateTenantDto);
  }

  async permanentDeleteTenant(tenantId: string): Promise<void> {
    return this.tenantManagementService.permanentDeleteTenant(tenantId);
  }

  async deleteTenant(tenantId: string): Promise<void> {
    return this.tenantManagementService.deleteTenant(tenantId);
  }

  async restoreTenant(tenantId: string): Promise<void> {
    return this.tenantManagementService.restoreTenant(tenantId);
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantManagementService.getTenantBySlug(slug);
  }

  async getTenantByInviteCode(inviteCode: string): Promise<Tenant | null> {
    return this.tenantInviteService.getTenantByInviteCode(inviteCode);
  }
}
