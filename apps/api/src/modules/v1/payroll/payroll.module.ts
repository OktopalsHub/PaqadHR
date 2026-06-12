import { PayrollAuditLogRepository } from './repositories/payroll-audit-log.repository';
import { PayrollItemRepository } from './repositories/payroll-item.repository';
import { PayrollRunRepository } from './repositories/payroll-run.repository';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from '../../../common/providers/payments.module';
import { EmploymentModule } from '../employment/employment.module';
import { PaymentMethodModule } from '../payment-method/payment-method.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { MultiPaymentService } from './services/multi-payment.service';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import { PayrollFeeService } from './services/payroll-fee.service';
import { PayrollService } from './services/payroll.service';
import { AuditService } from './services/audit.service';
import { ManualDisbursementService } from './services/manual-disbursement.service';
import { PayrollExportService } from './services/payroll-export.service';
import { PayrollRun } from "./entities/payroll-run.entity";
import { PayrollItem } from "./entities/payroll-item.entity";
import { PayrollAuditLog } from "./entities/payroll-audit.entity";
import { PayrollController } from "./controllers/payroll.controller";
import { PayrollFeeController } from "./controllers/payroll-fee.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([PayrollRun, PayrollItem, PayrollAuditLog]),
    PaymentsModule,
    SubscriptionsModule,
    PaymentMethodModule,
    TenantsModule,
    TenantMembersModule,
    EmploymentModule,
  ],
  controllers: [PayrollController, PayrollFeeController],
  providers: [
    PayrollRunRepository,
    PayrollItemRepository,
    PayrollAuditLogRepository,
    PayrollService,
    PayrollCalculationService,
    PayrollFeeService,
    MultiPaymentService,
    AuditService,
    ManualDisbursementService,
    PayrollExportService,
  ],
  exports: [
    PayrollService,
    PayrollCalculationService,
    PayrollFeeService,
    MultiPaymentService,
    AuditService,
  ],
})
export class PayrollModule {}
