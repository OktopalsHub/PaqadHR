import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { IPaginatedData } from 'src/common/interfaces';
import {
  type DeepPartial,
  type FindManyOptions,
  type FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import { PayrollRun } from '../entities/payroll-run.entity';

@Injectable()
export class PayrollRunRepository extends Repository<PayrollRun> {
  constructor(
    @InjectRepository(PayrollRun)
    private readonly payrollRunRepository: Repository<PayrollRun>,
  ) {
    super(
      payrollRunRepository.target,
      payrollRunRepository.manager,
      payrollRunRepository.queryRunner,
    );
  }
  async findByIdWithItems(id: string, tenantId: string): Promise<PayrollRun | null> {
    return this.findOne({
      where: { id, tenantId },
      relations: ['items', 'items.employee', 'createdBy'],
    });
  }
  async findByTenantId(tenantId: string): Promise<PayrollRun[]> {
    return this.find({
      withDeleted: false,
      where: { tenantId },
      relations: ['items', 'createdBy', 'tenant'],
    });
  }
  async findByTenantAndPeriod(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<PayrollRun | null> {
    return this.findOne({
      where: {
        tenantId,
        periodStart,
        periodEnd,
      },
      relations: ['items', 'createdBy'],
    });
  }
  async findActiveRunsForTenant(tenantId: string): Promise<PayrollRun[]> {
    return this.find({
      withDeleted: false,
      where: {
        tenantId,
        status: In([PayrollStatus.DRAFT, PayrollStatus.PROCESSING]),
      },
      relations: ['items', 'createdBy'],
    });
  }
  async findById(
    id: string,
    includeDeleted = false,
    additionalWhere?: FindOptionsWhere<PayrollRun>,
    relations?: string[],
  ): Promise<PayrollRun | null> {
    return this.findOne({
      where: { id, ...additionalWhere },
      withDeleted: includeDeleted,
      relations,
    });
  }
  async findAll(
    includeDeleted = false,
    where?: FindManyOptions<PayrollRun>['where'],
    relations?: string[],
  ): Promise<PayrollRun[]> {
    return this.find({ withDeleted: includeDeleted, where, relations });
  }
  async createAndSave(data: DeepPartial<PayrollRun>): Promise<PayrollRun> {
    const entity = super.create(data);
    return this.save(entity);
  }
  async updateAndReturn(
    id: string,
    tenantId: string,
    data: DeepPartial<PayrollRun>,
  ): Promise<PayrollRun | null> {
    await super.update({ id, tenantId }, data as Parameters<Repository<PayrollRun>['update']>[1]);
    return this.findByIdWithItems(id, tenantId);
  }
  /**
   * Tenant ids owning at least one PROCESSING item last touched before `cutoff`.
   *
   * Backs the reconciliation sweep. Resolving the owning tenants first lets the sweep query
   * per tenant with an explicit predicate, instead of selecting PROCESSING items across every
   * tenant in the instance. Distinct ids only, so one query covers a tenant's whole backlog.
   */
  async findDistinctTenantIdsWithProcessingItems(cutoff: Date): Promise<string[]> {
    const rows = await this.createQueryBuilder('run')
      .select('DISTINCT run.tenant_id', 'tenantId')
      .innerJoin('run.items', 'item', 'item.status = :status', {
        status: PayrollItemStatus.PROCESSING,
      })
      .andWhere('item.updated_at < :cutoff', { cutoff })
      .getRawMany<{ tenantId: string }>();

    return rows.map((row) => row.tenantId).filter((tenantId): tenantId is string => !!tenantId);
  }

  async findAllPaginated(
    page: number,
    limit: number,
    includeDeleted = false,
    where?: FindManyOptions<PayrollRun>['where'],
    relations?: string[],
    name = 'payrollRuns',
  ): Promise<IPaginatedData<PayrollRun>> {
    const [records, totalItems] = await this.findAndCount({
      withDeleted: includeDeleted,
      where,
      relations,
      skip: (page - 1) * limit,
      take: limit,
    });
    const pageCount = Math.ceil(totalItems / limit);
    return {
      name,
      size: records.length,
      pageCount,
      limit,
      page,
      previousPage: page > 1 ? page - 1 : null,
      nextPage: page < pageCount ? page + 1 : null,
      totalItems,
      records,
    };
  }
  async paginate(
    options: FindManyOptions<PayrollRun>,
  ): Promise<{ data: PayrollRun[]; total: number }> {
    const [data, total] = await this.payrollRunRepository.findAndCount(options);
    return { data, total };
  }
}
