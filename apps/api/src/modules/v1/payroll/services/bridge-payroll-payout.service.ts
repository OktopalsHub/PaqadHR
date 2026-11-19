import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BridgeApiService } from 'src/common/services/bridge-api.service';
import { DataSource, Repository } from 'typeorm';

import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { CustodyWallet } from '../../wallets/entities/custody-wallet.entity';
import { ProviderCustomer } from '../../wallets/entities/provider-customer.entity';
import { ProviderExternalAccount } from '../../wallets/entities/provider-external-account.entity';
import { ProviderWebhookEvent } from '../../wallets/entities/provider-webhook-event.entity';
import { WalletOperation } from '../../wallets/entities/wallet-operation.entity';
import { BridgeWalletService } from '../../wallets/services/bridge-wallet.service';
import { WalletLedgerService } from '../../wallets/services/wallet-ledger.service';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { BridgeApplyOps } from './bridge-apply.ops';
import { BridgeFundingAssessOps } from './bridge-funding-assess.ops';
import { BridgeHelperOps } from './bridge-helper.ops';
import { BridgeReadinessOps } from './bridge-readiness.ops';
import { BridgeReconcileOps } from './bridge-reconcile.ops';
import { BridgeRunContextOps } from './bridge-run-context.ops';
import { BridgeRunOps } from './bridge-run.ops';
import { BridgeTransferPrepOps } from './bridge-transfer-prep.ops';
import { BridgeTransferSubmitOps } from './bridge-transfer-submit.ops';
import { BridgeWithdrawalPrepOps } from './bridge-withdrawal-prep.ops';
import { BridgeWithdrawalSubmitOps } from './bridge-withdrawal-submit.ops';
import { PayrollAttemptHistoryService } from './payroll-attempt-history.service';
import { PayrollFeeService } from './payroll-fee.service';
import { PayrollPayoutService } from './payroll-payout.service';

@Injectable()
export class BridgePayrollPayoutService {
  private readonly helper: BridgeHelperOps;
  private readonly fundingAssess: BridgeFundingAssessOps;
  private readonly readiness: BridgeReadinessOps;
  private readonly transferPrep: BridgeTransferPrepOps;
  private readonly withdrawalPrep: BridgeWithdrawalPrepOps;
  private readonly withdrawalSubmit: BridgeWithdrawalSubmitOps;
  private readonly apply: BridgeApplyOps;
  private readonly transferSubmit: BridgeTransferSubmitOps;
  private readonly reconcile: BridgeReconcileOps;
  private readonly runContext: BridgeRunContextOps;
  private readonly run: BridgeRunOps;

  constructor(
    bridgeApi: BridgeApiService,
    bridgeWallets: BridgeWalletService,
    ledger: WalletLedgerService,
    payrollPayouts: PayrollPayoutService,
    payrollFees: PayrollFeeService,
    @InjectRepository(CustodyWallet) wallets: Repository<CustodyWallet>,
    @InjectRepository(ProviderCustomer)
    customers: Repository<ProviderCustomer>,
    @InjectRepository(WalletOperation)
    operations: Repository<WalletOperation>,
    @InjectRepository(ProviderWebhookEvent)
    webhookEvents: Repository<ProviderWebhookEvent>,
    @InjectRepository(ProviderExternalAccount)
    externalAccounts: Repository<ProviderExternalAccount>,
    @InjectRepository(TenantMember)
    members: Repository<TenantMember>,
    payrollItems: PayrollItemRepository,
    dataSource: DataSource,
    attemptHistory: PayrollAttemptHistoryService,
  ) {
    this.helper = new BridgeHelperOps(
      bridgeApi,
      ledger,
      operations,
      webhookEvents,
      payrollItems,
      attemptHistory,
    );
    this.fundingAssess = new BridgeFundingAssessOps(
      bridgeWallets,
      payrollFees,
      externalAccounts,
      this.helper,
    );
    this.readiness = new BridgeReadinessOps(
      payrollFees,
      wallets,
      externalAccounts,
      members,
      this.helper,
    );
    this.transferPrep = new BridgeTransferPrepOps(ledger, operations, attemptHistory, this.helper);
    this.withdrawalPrep = new BridgeWithdrawalPrepOps(
      bridgeApi,
      wallets,
      customers,
      operations,
      externalAccounts,
      this.helper,
    );
    this.withdrawalSubmit = new BridgeWithdrawalSubmitOps(
      bridgeApi,
      ledger,
      operations,
      payrollItems,
      dataSource,
      this.helper,
    );
    this.apply = new BridgeApplyOps(
      ledger,
      payrollPayouts,
      operations,
      payrollItems,
      dataSource,
      this.helper,
      this.withdrawalPrep,
      this.withdrawalSubmit,
    );
    this.transferSubmit = new BridgeTransferSubmitOps(
      bridgeApi,
      ledger,
      operations,
      payrollItems,
      dataSource,
      attemptHistory,
      this.apply,
      this.helper,
      this.transferPrep,
    );
    this.reconcile = new BridgeReconcileOps(
      bridgeApi,
      wallets,
      customers,
      operations,
      webhookEvents,
      this.apply,
      this.helper,
    );
    this.runContext = new BridgeRunContextOps(
      bridgeWallets,
      payrollFees,
      wallets,
      customers,
      operations,
      externalAccounts,
      members,
      this.helper,
    );
    this.run = new BridgeRunOps(
      payrollPayouts,
      payrollItems,
      this.apply,
      this.runContext,
      this.transferSubmit,
    );
  }

  assessFundingRequirement(
    ...args: Parameters<BridgeFundingAssessOps['assessFundingRequirement']>
  ) {
    return this.fundingAssess.assessFundingRequirement(...args);
  }

  assessRunReadiness(...args: Parameters<BridgeReadinessOps['assessRunReadiness']>) {
    return this.readiness.assessRunReadiness(...args);
  }

  processRun(...args: Parameters<BridgeRunOps['processRun']>) {
    return this.run.processRun(...args);
  }

  reconcilePendingTransfers(...args: Parameters<BridgeReconcileOps['reconcilePendingTransfers']>) {
    return this.reconcile.reconcilePendingTransfers(...args);
  }

  dispatchTransferWebhook(...args: Parameters<BridgeReconcileOps['dispatchTransferWebhook']>) {
    return this.reconcile.dispatchTransferWebhook(...args);
  }
}
