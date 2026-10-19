import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

const TENANT_NAME_CACHE_TTL_MS = 5 * 60 * 1000;
const TENANT_NAME_CACHE_MAX_ENTRIES = 500;

/**
 * Resolves the workspace (organization) name that member-facing emails are signed with.
 *
 * A payroll run sends one email per employee, so resolving the tenant row per recipient would
 * repeat the same primary-key lookup for every member of the same workspace. The name changes
 * rarely, so it is cached briefly: a name that is a few minutes stale is harmless, while a
 * payroll run of any size still costs one query.
 */
@Injectable()
export class TenantNameService {
  private readonly cache = new Map<string, { name: string; expiresAt: number }>();

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async resolve(tenantId: string): Promise<string | null> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.name;

    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    const name = tenant?.name?.trim();
    if (!name) return null;

    if (this.cache.size >= TENANT_NAME_CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(tenantId, { name, expiresAt: Date.now() + TENANT_NAME_CACHE_TTL_MS });
    return name;
  }
}
