import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagerAccessModule } from '../../../common/modules/manager-access.module';
import { PaymentsModule } from '../../../common/providers/payments.module';
import { FiatExchangeService } from '../../../common/services/fiat-exchange.service';
import { ActivitiesModule } from '../activities/activities.module';
import { EmploymentModule } from '../employment/employment.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentMethodModule } from '../payment-method/payment-method.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantConfigModule } from '../tenant-settings/tenant-config.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantsModule } from '../tenants/tenants.module';
import { PayrollExportController } from './controllers/payroll-export.controller';
import { PayrollFeeController } from './controllers/payroll-fee.controller';
import { PayrollItemsController } from './controllers/payroll-items.controller';
import { PayrollPayoutController } from './controllers/payroll-payout.controller';
import { PayrollRunsController } from './controllers/payroll-runs.controller';
import { PayrollWebhooksController } from './controllers/payroll-webhooks.controller';
import { PayrollItem } from './entities/payroll-item.entity';
import { PayrollRun } from './entities/payroll-run.entity';
import { PayrollItemRepository } from './repositories/payroll-item.repository';
import { PayrollRunRepository } from './repositories/payroll-run.repository';
import { AuditService } from './services/audit.service';
import { ManualDisbursementService } from './services/manual-disbursement.service';
import { MultiPaymentService } from './services/multi-payment.service';
import { PayrollService } from './services/payroll.service';
import { PayrollAccessGuard } from './services/payroll-access-guard';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import { PayrollExportService } from './services/payroll-export.service';
import { PayrollFeeService } from './services/payroll-fee.service';
import { PayrollFloatBalanceService } from './services/payroll-float-balance.service';
import { PayrollFloatTopupService } from './services/payroll-float-topup.service';
import { PayrollLifecycleNotifyService } from './services/payroll-lifecycle-notify.service';
import { PayrollPaymentOrchestrator } from './services/payroll-payment-orchestrator';
import { PayrollPayoutService } from './services/payroll-payout.service';
import { PayrollPayoutCronService } from './services/payroll-payout-cron.service';
import { PayrollRunService } from './services/payroll-run.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayrollRun, PayrollItem, Tenant]),
    ActivitiesModule,
    PaymentsModule,
    SubscriptionsModule,
    NotificationsModule,
    PaymentMethodModule,
    TenantsModule,
    TenantMembersModule,
    EmploymentModule,
    TenantConfigModule,
    ManagerAccessModule,
  ],
  controllers: [
    PayrollRunsController,
    PayrollItemsController,
    PayrollPayoutController,
    PayrollExportController,
    PayrollFeeController,
    PayrollWebhooksController,
  ],
  providers: [
    FiatExchangeService,
    PayrollRunRepository,
    PayrollItemRepository,
    PayrollAccessGuard,
    PayrollRunService,
    PayrollPaymentOrchestrator,
    PayrollService,
    PayrollCalculationService,
    PayrollFeeService,
    PayrollLifecycleNotifyService,
    MultiPaymentService,
    AuditService,
    ManualDisbursementService,
    PayrollExportService,
    PayrollPayoutService,
    PayrollPayoutCronService,
    PayrollFloatBalanceService,
    PayrollFloatTopupService,
  ],
  exports: [
    PayrollService,
    PayrollRunService,
    PayrollPaymentOrchestrator,
    PayrollAccessGuard,
    PayrollCalculationService,
    PayrollFeeService,
    MultiPaymentService,
    AuditService,
    PayrollLifecycleNotifyService,
    PayrollPayoutService,
    PayrollFloatTopupService,
  ],
})
export class PayrollModule {}
