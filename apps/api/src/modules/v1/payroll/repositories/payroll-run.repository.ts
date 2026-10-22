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

  /**
   * Tenant ids with paid Bachs items. The payout reconciliation sweep uses this list to
   * recover provider-confirmed debits if the payroll state committed but the ledger write
   * failed, including when no new webhook is delivered.
   */
  async findDistinctTenantIdsWithPaidBachsItems(): Promise<string[]> {
    const rows = await this.createQueryBuilder('run')
      .select('DISTINCT run.tenant_id', 'tenantId')
      .innerJoin('run.items', 'item', 'item.status = :status', {
        status: PayrollItemStatus.PAID,
      })
      .andWhere('LOWER(item.payment_provider) LIKE :provider', { provider: '%bachs%' })
      .getRawMany<{ tenantId: string }>();

    return rows.map((row) => row.tenantId).filter((tenantId): tenantId is string => !!tenantId);
  }

  /**
   * Runs with a retry funding approval or checkout that has been open since before `cutoff`.
   *
   * The retry funding state lives in the run metadata JSON, so it is read with a JSONB cast
   * instead of loading every run. Only the columns the expiry sweep needs are selected.
   */
  async findRunsWithOpenRetryFundingBefore(cutoff: Date, limit = 50): Promise<PayrollRun[]> {
    return this.createQueryBuilder('run')
      .select(['run.id', 'run.tenantId', 'run.status', 'run.metadata', 'run.updatedAt'])
      .where(`run.metadata::jsonb -> 'retryFunding' ->> 'status' IN (:...statuses)`, {
        statuses: ['approved', 'pending'],
      })
      .andWhere(
        `COALESCE(
           run.metadata::jsonb -> 'retryFunding' ->> 'checkoutRequestedAt',
           run.metadata::jsonb -> 'retryFunding' ->> 'approvedAt'
         )::timestamptz < :cutoff`,
        { cutoff },
      )
      .orderBy('run.updatedAt', 'ASC')
      .limit(limit)
      .getMany();
  }

  /**
   * Runs across tenants that still hold an open retry funding approval or checkout.
   *
   * Backs the support view: an operator needs to find the run a tenant is stuck on without
   * loading every payroll run in the instance.
   */
  async findRunsWithOpenRetryFunding(limit = 50): Promise<PayrollRun[]> {
    return this.createQueryBuilder('run')
      .select([
        'run.id',
        'run.tenantId',
        'run.title',
        'run.status',
        'run.metadata',
        'run.updatedAt',
      ])
      .where(`run.metadata::jsonb -> 'retryFunding' ->> 'status' IN (:...statuses)`, {
        statuses: ['approved', 'pending'],
      })
      .orderBy('run.updatedAt', 'DESC')
      .limit(limit)
      .getMany();
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
