import { InjectRepository } from '@nestjs/typeorm';
import { assertBridgePayrollCapability } from 'src/common/config/bridge-payroll-capabilities.config';
import { BridgeApiService } from 'src/common/services/bridge-api.service';
import { Repository } from 'typeorm';

import { CustodyWallet } from '../../wallets/entities/custody-wallet.entity';
import { ProviderCustomer } from '../../wallets/entities/provider-customer.entity';
import { ProviderExternalAccount } from '../../wallets/entities/provider-external-account.entity';
import { WalletOperation } from '../../wallets/entities/wallet-operation.entity';
import { BridgeHelperOps } from './bridge-helper.ops';
import { WithdrawalMeta } from './bridge-payroll-payout.shared';

export class BridgeWithdrawalPrepOps {
  constructor(
    private readonly bridgeApi: BridgeApiService,
    @InjectRepository(CustodyWallet) private readonly wallets: Repository<CustodyWallet>,
    @InjectRepository(ProviderCustomer)
    private readonly customers: Repository<ProviderCustomer>,
    @InjectRepository(WalletOperation)
    private readonly operations: Repository<WalletOperation>,
    @InjectRepository(ProviderExternalAccount)
    private readonly externalAccounts: Repository<ProviderExternalAccount>,
    private readonly helper: BridgeHelperOps,
  ) {}

  async readWithdrawalMetadata(parent: WalletOperation) {
    if (parent.kind !== 'transfer' || parent.status !== 'completed') return;
    const metadata = parent.metadata ?? {};
    const userId = typeof metadata.employeeUserId === 'string' ? metadata.employeeUserId : null;
    const externalAccountId =
      typeof metadata.providerExternalAccountId === 'string'
        ? metadata.providerExternalAccountId
        : null;
    const sourceCurrency = parent.destinationCurrency;
    const destinationAmount =
      typeof metadata.fiatDestinationAmount === 'string' ? metadata.fiatDestinationAmount : null;
    const destinationCurrency =
      typeof metadata.fiatDestinationCurrency === 'string'
        ? metadata.fiatDestinationCurrency
        : null;
    const employeeCustomerRecordId =
      typeof metadata.employeeCustomerRecordId === 'string'
        ? metadata.employeeCustomerRecordId
        : null;
    const memberId =
      typeof metadata.employeeMemberId === 'string' ? metadata.employeeMemberId : null;
    const paymentMethodId =
      typeof metadata.employeePaymentMethodId === 'string'
        ? metadata.employeePaymentMethodId
        : null;
    if (
      metadata.payoutMode !== 'bank' ||
      !userId ||
      !externalAccountId ||
      !sourceCurrency ||
      !destinationAmount ||
      !destinationCurrency ||
      !employeeCustomerRecordId ||
      !memberId ||
      !paymentMethodId ||
      !parent.payrollItemId ||
      !parent.destinationWalletId
    ) {
      return undefined;
    }

    return {
      userId,
      externalAccountId,
      sourceCurrency,
      destinationAmount,
      destinationCurrency,
      employeeCustomerRecordId,
      memberId,
      paymentMethodId,
      payrollItemId: parent.payrollItemId,
      destinationWalletId: parent.destinationWalletId,
    };
  }

  async selectWithdrawalAttempt(
    parent: WalletOperation,
    allowRetry: boolean,
    payrollItemId: string,
  ) {
    const previousWithdrawals = await this.operations.find({
      where: {
        tenantId: parent.tenantId,
        payrollItemId: payrollItemId,
        kind: 'withdrawal',
        provider: 'bridge',
      },
      select: { id: true, idempotencyKey: true, status: true, metadata: true, updatedAt: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    const relatedWithdrawals = previousWithdrawals.filter(
      (operation) => operation.metadata?.parentOperationId === parent.id,
    );
    const previous = relatedWithdrawals[0];
    if (previous && previous.status !== 'failed') return;
    if (previous?.status === 'failed' && !allowRetry) return;
    const attempt = previous ? Number(previous.metadata?.withdrawalAttempt ?? 1) + 1 : 1;
    const idempotencyKey = `${parent.idempotencyKey}:withdrawal:${attempt}`;
    const existing = await this.operations.findOne({ where: { idempotencyKey } });
    if (existing) return;

    return { attempt, idempotencyKey };
  }

  async loadWithdrawalParties(parent: WalletOperation, meta: WithdrawalMeta) {
    const {
      userId,
      externalAccountId,
      sourceCurrency,
      destinationCurrency,
      employeeCustomerRecordId,
      memberId,
      paymentMethodId,
      destinationWalletId,
    } = meta;
    const externalAccount = await this.externalAccounts.findOne({
      where: {
        tenantId: parent.tenantId,
        memberId,
        userId,
        paymentMethodId,
        provider: 'bridge',
        providerExternalAccountId: externalAccountId,
        status: 'active',
      },
    });
    const employeeWallet = await this.wallets.findOne({
      where: {
        id: destinationWalletId,
        ownerType: 'employee',
        userId,
        provider: 'bridge',
        status: 'active',
      },
      select: { id: true, providerWalletId: true, network: true },
    });
    const customer = await this.customers.findOne({
      where: {
        id: employeeCustomerRecordId,
        ownerType: 'employee',
        userId,
        provider: 'bridge',
      },
      select: {
        id: true,
        providerCustomerId: true,
        status: true,
        kycStatus: true,
        termsStatus: true,
      },
    });
    if (
      !externalAccount ||
      !employeeWallet ||
      !customer?.providerCustomerId ||
      customer.status !== 'approved' ||
      customer.kycStatus !== 'approved' ||
      customer.termsStatus !== 'approved'
    ) {
      await this.helper.markBankPayoutForReview(
        parent,
        'Employee Bridge bank destination requires review.',
      );
      return undefined;
    }

    const providerExternalAccount = await this.bridgeApi.getExternalAccount(
      customer.providerCustomerId,
      externalAccount.providerExternalAccountId,
    );
    if (providerExternalAccount.active !== true) {
      await this.helper.markBankPayoutForReview(
        parent,
        'Bridge reports the employee bank account is no longer active.',
      );
      return undefined;
    }

    let capability: ReturnType<typeof assertBridgePayrollCapability>;
    try {
      capability = assertBridgePayrollCapability({
        operation: 'withdrawal',
        sourceCurrency: sourceCurrency as 'USDC' | 'USDT',
        currency: destinationCurrency as 'USD' | 'EUR' | 'GBP',
        country: externalAccount.country,
        network: externalAccount.network,
      });
    } catch (error) {
      await this.helper.markBankPayoutForReview(
        parent,
        error instanceof Error ? error.message : 'Bridge bank payout route is disabled.',
      );
      return undefined;
    }
    if (!capability.bridgeCurrency || !capability.bridgePaymentRail) {
      await this.helper.markBankPayoutForReview(
        parent,
        'Bridge bank payout rail mapping is missing.',
      );
      return undefined;
    }

    return {
      externalAccount,
      employeeWallet,
      customerId: customer.providerCustomerId,
      bridgeCurrency: capability.bridgeCurrency,
      bridgePaymentRail: capability.bridgePaymentRail,
    };
  }
}
