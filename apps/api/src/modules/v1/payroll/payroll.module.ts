import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from '../../../common/providers/payments.module';
import { ActivitiesModule } from '../activities/activities.module';
import { EmploymentModule } from '../employment/employment.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentMethodModule } from '../payment-method/payment-method.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantConfigModule } from '../tenant-settings/tenant-config.module';
import { TenantsModule } from '../tenants/tenants.module';
import { PayrollController } from './controllers/payroll.controller';
import { PayrollFeeController } from './controllers/payroll-fee.controller';
import { PayrollWebhooksController } from './controllers/payroll-webhooks.controller';
import { PayrollItem } from './entities/payroll-item.entity';
import { PayrollRun } from './entities/payroll-run.entity';
import { PayrollItemRepository } from './repositories/payroll-item.repository';
import { PayrollRunRepository } from './repositories/payroll-run.repository';
import { AuditService } from './services/audit.service';
import { ManualDisbursementService } from './services/manual-disbursement.service';
import { MultiPaymentService } from './services/multi-payment.service';
import { PayrollService } from './services/payroll.service';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import { PayrollExportService } from './services/payroll-export.service';
import { PayrollFeeService } from './services/payroll-fee.service';
import { PayrollPayoutService } from './services/payroll-payout.service';
import { PayrollPayoutCronService } from './services/payroll-payout-cron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayrollRun, PayrollItem]),
    ActivitiesModule,
    PaymentsModule,
    SubscriptionsModule,
    NotificationsModule,
    PaymentMethodModule,
    TenantsModule,
    TenantMembersModule,
    EmploymentModule,
    TenantConfigModule,
  ],
  controllers: [PayrollController, PayrollFeeController, PayrollWebhooksController],
  providers: [
    PayrollRunRepository,
    PayrollItemRepository,
    PayrollService,
    PayrollCalculationService,
    PayrollFeeService,
    MultiPaymentService,
    AuditService,
    ManualDisbursementService,
    PayrollExportService,
    PayrollPayoutService,
    PayrollPayoutCronService,
  ],
  exports: [
    PayrollService,
    PayrollCalculationService,
    PayrollFeeService,
    MultiPaymentService,
    AuditService,
    PayrollPayoutService,
  ],
})
export class PayrollModule {}
