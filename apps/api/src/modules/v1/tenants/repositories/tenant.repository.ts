import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import type { ITenantRepository } from '../../../../common/interfaces/itenant-repository.interface';
import { Tenant } from '../entities/tenant.entity';

@Injectable()
export class TenantRepository extends Repository<Tenant> implements ITenantRepository {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {
    super(tenantRepository.target, tenantRepository.manager, tenantRepository.queryRunner);
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { slug } });
  }
  async findSlugsStartingWith(baseSlug: string): Promise<string[]> {
    const tenants = await this.tenantRepository.find({
      where: { slug: Like(`${baseSlug}%`) },
      select: ['slug'],
    });
    return tenants.map((tenant) => tenant.slug);
  }
  async getTenantByIds(ids: string[]): Promise<Tenant[]> {
    if (!ids?.length) return [];
    return this.tenantRepository.find({ where: { id: In(ids) } });
  }
  async findByInviteCode(inviteCode: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { inviteCode } });
  }
}
