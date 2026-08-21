import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../../audit-logs/services/audit.service';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { PayrollFrequency, PayrollStatus, PayrollItemStatus } from '../enums/payroll.enum';
import type { CreatePayrollRunDto } from '../dto/create-payroll-run.dto';
import type { AuditContext } from '../../audit-logs/entities/audit-log.entity';

/**
 * Handles payroll run creation and calculation.
 */
@Injectable()
export class PayrollRunService {
  private readonly logger = new Logger(PayrollRunService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(PayrollRun)
    private readonly payrollRunRepository: Repository<PayrollRun>,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepository: Repository<PayrollItem>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly auditService: AuditService,
  ) { }

  async createPayrollRun(
    dto: CreatePayrollRunDto,
    tenantId: string,
    createdById: string,
    idempotencyKey?: string,
  ): Promise<PayrollRun & { alreadyExists?: boolean }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const finalIdempotencyKey =
        idempotencyKey ||
        `${tenantId}-${dto.periodStart.toISOString()}-${dto.periodEnd.toISOString()}`;

      // Lock tenant row to prevent concurrent creation
      await queryRunner.query(`SELECT id FROM tenants WHERE id = $1 FOR UPDATE`, [tenantId]);

      // Check for existing payroll run with same idempotency key
      if (finalIdempotencyKey) {
        const existingByKey = await this.payrollRunRepository.findOne({
          where: { idempotencyKey: finalIdempotencyKey },
        });
        if (existingByKey) {
          await queryRunner.rollbackTransaction();
          return Object.assign(existingByKey, { alreadyExists: true });
        }
      }

      // Check for existing payroll run with same period
      const existingRun = await this.payrollRunRepository.findOne({
        where: {
          tenantId,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
        },
      });
      if (existingRun) {
        await queryRunner.rollbackTransaction();
        return Object.assign(existingRun, { alreadyExists: true });
      }

      // Create payroll run
      const payrollRunData = {
        title: dto.title,
        frequency: dto.frequency as unknown as PayrollFrequency,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        paymentDate: dto.paymentDate,
        baseCurrency: dto.baseCurrency,
        status: PayrollStatus.DRAFT,
        employeeCount: dto.employeeIds.length,
        createdById,
        tenantId,
        idempotencyKey: finalIdempotencyKey,
        payoutMode: null,
      };

      const savedPayrollRun = await this.payrollRunRepository.save(payrollRunData);

      // Create payroll items for each employee
      for (const memberId of dto.employeeIds) {
        await this.payrollItemRepository.save({
          payrollRunId: savedPayrollRun.id,
          memberId,
          status: PayrollItemStatus.PENDING,
          baseSalary: 0,
          baseSalaryCurrency: dto.baseCurrency,
          grossAmount: 0,
          netAmount: 0,
          paymentCurrency: dto.baseCurrency,
          paymentAmount: 0,
          exchangeRate: 1,
        });
      }

      await queryRunner.commitTransaction();

      // Audit log
      await this.auditService.logPayrollCreated(
        { tenantId, payrollRunId: savedPayrollRun.id, performedById: createdById },
        {
          title: dto.title,
          frequency: dto.frequency,
          employeeCount: dto.employeeIds.length,
          baseCurrency: dto.baseCurrency,
        },
      );

      return savedPayrollRun;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to create payroll run:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async calculatePayrollAmounts(payrollRunId: string, tenantId: string) {
    // TODO: Extract full calculatePayroll method from payroll.service.ts lines 167-361
    // For now, return empty array
    return [];
  }

  async acquireProcessingLock(
    payrollRunId: string,
    tenantId: string,
    performedById: string,
  ): Promise<PayrollRun | null> {
    // TODO: Extract from payroll.service.ts lines 766-809
    return null;
  }

  async releaseProcessingLock(payrollRunId: string): Promise<void> {
    // TODO: Extract from payroll.service.ts lines 810-815
  }
}
