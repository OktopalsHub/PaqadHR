import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tenant } from "./entities/tenant.entity";

@Injectable()
export class TenantRepository extends Repository<Tenant> {
  constructor(
    @InjectRepository(Tenant)
    repository: Repository<Tenant>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.findOne({ where: { id } });
  }

  async findByInviteCode(inviteCode: string): Promise<Tenant | null> {
    return this.findOne({ where: { inviteCode } });
  }
  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.findOne({ where: { slug } });
  }
  async getTenantByIds(tenantIds: string[]): Promise<Tenant[]> {
    if (!tenantIds || tenantIds.length === 0) {
      return [];
    }
    return this.find({
      where: { id: In(tenantIds) },
    });
  }
  async findSlugsStartingWith(baseSlug: string): Promise<string[]> {
    const queryBuilder = this.createQueryBuilder('tenant');
    const tenants = await queryBuilder
      .select(['tenant.slug'])
      .where('tenant.slug LIKE :slug', { slug: `${baseSlug}%` })
      .getMany();
    return tenants.map((tenant) => tenant.slug);
  }
}
