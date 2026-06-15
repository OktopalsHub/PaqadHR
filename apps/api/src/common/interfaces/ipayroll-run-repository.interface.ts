import type { IPaginatedData } from 'src/common/interfaces';
import type {
  DeepPartial,
  DeleteResult,
  FindManyOptions,
  FindOneOptions,
  UpdateResult,
} from 'typeorm';
import type { PayrollRun } from '../../modules/v1/payroll/entities/payroll-run.entity';

export interface IPayrollRunRepository {
  findByIdWithItems(id: string): Promise<PayrollRun | null>;
  findByTenantId(tenantId: string): Promise<PayrollRun[]>;
  findByTenantAndPeriod(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<PayrollRun | null>;
  findActiveRunsForTenant(tenantId: string): Promise<PayrollRun[]>;
  findOne(options: FindOneOptions<PayrollRun>): Promise<PayrollRun | null>;
  findAll(
    includeDeleted?: boolean,
    where?: FindManyOptions<PayrollRun>['where'],
    relations?: string[],
  ): Promise<PayrollRun[]>;
  findById(
    id: string,
    includeDeleted?: boolean,
    additionalWhere?: FindOneOptions<PayrollRun>['where'],
    relations?: string[],
  ): Promise<PayrollRun | null>;
  create(data: DeepPartial<PayrollRun>): Promise<PayrollRun>;
  update(id: string, data: DeepPartial<PayrollRun>): Promise<PayrollRun | null>;
  delete(id: string): Promise<DeleteResult>;
  softDelete(id: string): Promise<DeleteResult>;
  restore(id: string): Promise<UpdateResult>;
  count(where: Partial<PayrollRun>): Promise<number>;
  findAllPaginated(
    page: number,
    limit: number,
    includeDeleted?: boolean,
    where?: FindManyOptions<PayrollRun>['where'],
    relations?: string[],
    name?: string,
  ): Promise<IPaginatedData<PayrollRun>>;
  paginate(options: FindManyOptions<PayrollRun>): Promise<{ data: PayrollRun[]; total: number }>;
}
