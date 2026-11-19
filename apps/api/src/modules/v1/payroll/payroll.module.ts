import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronClaimModule } from 'src/common/modules/cron-claim.module';

import { ManagerAccessModule } from '../../../common/modules/manager-access.module';
import { BridgeModule } from '../../../common/providers/bridge.module';
import { PaymentsModule } from '../../../common/providers/payments.module';
import { ActivitiesModule } from '../activities/activities.module';
import { EmploymentModule } from '../employment/employment.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentMethod } from '../payment-method/entities/payment-method.entity';
import { PaymentMethodModule } from '../payment-method/payment-method.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantConfigModule } from '../tenant-settings/tenant-config.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantsModule } from '../tenants/tenants.module';
import { CustodyWallet } from '../wallets/entities/custody-wallet.entity';
import { ProviderCustomer } from '../wallets/entities/provider-customer.entity';
import { ProviderExternalAccount } from '../wallets/entities/provider-external-account.entity';
import { ProviderWebhookEvent } from '../wallets/entities/provider-webhook-event.entity';
import { WalletOperation } from '../wallets/entities/wallet-operation.entity';
import { WalletsModule } from '../wallets/wallets.module';
import { PayrollExportController } from './controllers/payroll-export.controller';
import { PayrollFeeController } from './controllers/payroll-fee.controller';
import { PayrollItemsController } from './controllers/payroll-items.controller';
import { PayrollPayoutController } from './controllers/payroll-payout.controller';
import { PayrollRunsController } from './controllers/payroll-runs.controller';
import { PayrollWebhooksController } from './controllers/payroll-webhooks.controller';
import { PayrollFundingAttempt } from './entities/payroll-funding-attempt.entity';
import { PayrollItem } from './entities/payroll-item.entity';
import { PayrollPayoutAttempt } from './entities/payroll-payout-attempt.entity';
import { PayrollRunFundingLedgerEntry } from './entities/payroll-run-funding-ledger-entry.entity';
import { PayrollRun } from './entities/payroll-run.entity';
import { PayrollWebhookEvent } from './entities/payroll-webhook-event.entity';
import { PayrollItemRepository } from './repositories/payroll-item.repository';
import { PayrollRunRepository } from './repositories/payroll-run.repository';
import { AuditService } from './services/audit.service';
import { BridgePayrollPayoutService } from './services/bridge-payroll-payout.service';
import { ManualDisbursementService } from './services/manual-disbursement.service';
import { MultiPaymentService } from './services/multi-payment.service';
import { NombaPayrollPayoutService } from './services/nomba-payroll-payout.service';
import { PayoutApplyOps } from './services/payout-apply.ops';
import { PayoutLookupOps } from './services/payout-lookup.ops';
import { PayoutRetryOps } from './services/payout-retry.ops';
import { PayoutBranchOps } from './services/payout-status-branch.ops';
import { PayoutStuckOps } from './services/payout-stuck.ops';
import { PayoutWebhooks } from './services/payout-webhooks';
import { PayrollAccessGuard } from './services/payroll-access-guard';
import { PayrollAttemptHistoryService } from './services/payroll-attempt-history.service';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import { PayrollExportService } from './services/payroll-export.service';
import { PayrollFeeService } from './services/payroll-fee.service';
import { PayrollFloatBalanceService } from './services/payroll-float-balance.service';
import { PayrollFloatTopupCheckoutService } from './services/payroll-float-topup-checkout.service';
import { PayrollFloatTopupCompletionService } from './services/payroll-float-topup-completion.service';
import { PayrollFloatTopupRunService } from './services/payroll-float-topup-run.service';
import { PayrollFundingPreflightService } from './services/payroll-funding-preflight.service';
import { PayrollFundingOps } from './services/payroll-funding.ops';
import { PayrollFundingService } from './services/payroll-funding.service';
import { PayrollLifecycleNotifyService } from './services/payroll-lifecycle-notify.service';
import { PayrollPaymentOrchestrator } from './services/payroll-payment-orchestrator';
import { PayrollPaymentOps } from './services/payroll-payment.ops';
import { PayrollPayoutCronService } from './services/payroll-payout-cron.service';
import { PayrollPayoutService } from './services/payroll-payout.service';
import { PayrollPayslipOps } from './services/payroll-payslip.ops';
import { PayrollRunFundingLedgerService } from './services/payroll-run-funding-ledger.service';
import { PayrollRunOps } from './services/payroll-run.ops';
import { PayrollRunService } from './services/payroll-run.service';

@Module({
  imports: [
    CronClaimModule,
    TypeOrmModule.forFeature([
      PayrollRun,
      PayrollItem,
      PaymentMethod,
      PayrollWebhookEvent,
      PayrollRunFundingLedgerEntry,
      PayrollFundingAttempt,
      PayrollPayoutAttempt,
      Tenant,
      TenantMember,
      CustodyWallet,
      ProviderCustomer,
      ProviderExternalAccount,
      ProviderWebhookEvent,
      WalletOperation,
    ]),
    ActivitiesModule,
    PaymentsModule,
    BridgeModule,
    SubscriptionsModule,
    NotificationsModule,
    PaymentMethodModule,
    TenantsModule,
    TenantMembersModule,
    EmploymentModule,
    TenantConfigModule,
    ManagerAccessModule,
    WalletsModule,
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
    PayrollRunRepository,
    PayrollItemRepository,
    PayrollAccessGuard,
    PayrollRunService,
    PayrollPaymentOrchestrator,
    PayrollRunOps,
    PayrollPaymentOps,
    PayrollFundingOps,
    PayrollPayslipOps,
    PayrollCalculationService,
    PayrollFeeService,
    PayrollLifecycleNotifyService,
    MultiPaymentService,
    NombaPayrollPayoutService,
    BridgePayrollPayoutService,
    AuditService,
    ManualDisbursementService,
    PayrollExportService,
    PayoutLookupOps,
    PayoutBranchOps,
    PayoutApplyOps,
    PayoutStuckOps,
    PayoutRetryOps,
    PayoutWebhooks,
    PayrollPayoutService,
    PayrollPayoutCronService,
    PayrollFloatBalanceService,
    PayrollFundingService,
    PayrollFundingPreflightService,
    PayrollFloatTopupCheckoutService,
    PayrollFloatTopupCompletionService,
    PayrollFloatTopupRunService,
    PayrollRunFundingLedgerService,
    PayrollAttemptHistoryService,
  ],
  exports: [
    PayrollRunService,
    PayrollPaymentOrchestrator,
    PayrollAccessGuard,
    PayrollCalculationService,
    PayrollFeeService,
    MultiPaymentService,
    AuditService,
    PayrollLifecycleNotifyService,
    PayrollPayoutService,
    BridgePayrollPayoutService,
    PayrollFundingService,
    PayrollRunFundingLedgerService,
    PayrollAttemptHistoryService,
  ],
})
export class PayrollModule {}
