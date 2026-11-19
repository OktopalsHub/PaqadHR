import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isBridgeDeveloperFeeCollectionEnabled } from 'src/common/config/bridge.config';
import { In, Repository } from 'typeorm';

import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { CustodyWallet } from '../../wallets/entities/custody-wallet.entity';
import { ProviderCustomer } from '../../wallets/entities/provider-customer.entity';
import { ProviderExternalAccount } from '../../wallets/entities/provider-external-account.entity';
import { WalletOperation } from '../../wallets/entities/wallet-operation.entity';
import { BridgeWalletService } from '../../wallets/services/bridge-wallet.service';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { addMoneyAmounts, multiplyMoneyByRate } from '../utils/payroll-platform-fee.util';
import { BridgeHelperOps } from './bridge-helper.ops';
import { RunPayoutContext } from './bridge-payroll-payout.shared';
import { PayrollFeeService } from './payroll-fee.service';

export class BridgeRunContextOps {
  constructor(
    private readonly bridgeWallets: BridgeWalletService,
    private readonly payrollFees: PayrollFeeService,
    @InjectRepository(CustodyWallet) private readonly wallets: Repository<CustodyWallet>,
    @InjectRepository(ProviderCustomer)
    private readonly customers: Repository<ProviderCustomer>,
    @InjectRepository(WalletOperation)
    private readonly operations: Repository<WalletOperation>,
    @InjectRepository(ProviderExternalAccount)
    private readonly externalAccounts: Repository<ProviderExternalAccount>,
    @InjectRepository(TenantMember)
    private readonly members: Repository<TenantMember>,
    private readonly helper: BridgeHelperOps,
  ) {}

  async loadRunContext(run: PayrollRun, items: PayrollItem[], tenantId: string) {
    const country = run.tenant?.countryCode?.toUpperCase();
    if (!country)
      throw new ServiceUnavailableException('Organization country is required for Bridge payroll.');
    const memberIds = [...new Set(items.map((item) => item.memberId))];
    const memberRows = memberIds.length
      ? await this.members.find({
          where: { id: In(memberIds), tenantId },
          select: { id: true, userId: true },
        })
      : [];
    const userByMember = new Map(memberRows.map((member) => [member.id, member.userId]));
    const paymentMethodIds = [
      ...new Set(items.map((item) => item.paymentMethodId).filter(Boolean)),
    ];
    const externalAccounts = paymentMethodIds.length
      ? await this.externalAccounts.find({
          where: {
            tenantId,
            memberId: In(memberIds),
            paymentMethodId: In(paymentMethodIds),
            provider: 'bridge',
            status: 'active',
          },
          select: {
            tenantId: true,
            memberId: true,
            userId: true,
            paymentMethodId: true,
            providerCustomerId: true,
            providerExternalAccountId: true,
            currency: true,
            country: true,
            sourceCurrency: true,
            network: true,
          },
        })
      : [];
    const externalAccountByMethod = new Map(
      externalAccounts.map((account) => [account.paymentMethodId, account]),
    );
    const networks = [
      ...new Set([
        ...items.map((item) => this.helper.readNetwork(item)).filter(Boolean),
        ...externalAccounts.map((account) => account.network),
      ]),
    ];
    const orgWallets = await this.wallets.find({
      where: { ownerType: 'organization', tenantId, provider: 'bridge', status: 'active' },
      select: { id: true, providerCustomerId: true, providerWalletId: true, network: true },
    });
    const employeeWallets =
      memberRows.length && networks.length
        ? await this.wallets.find({
            where: {
              ownerType: 'employee',
              userId: In(memberRows.map((member) => member.userId)),
              provider: 'bridge',
              status: 'active',
              network: In(networks),
            },
            select: {
              id: true,
              userId: true,
              providerCustomerId: true,
              providerWalletId: true,
              network: true,
            },
          })
        : [];
    const customerIds = [...new Set(orgWallets.map((wallet) => wallet.providerCustomerId))];
    const customerRows = customerIds.length
      ? await this.customers.find({
          where: { id: In(customerIds), provider: 'bridge' },
          select: { id: true, providerCustomerId: true },
        })
      : [];
    const customerById = new Map(
      customerRows.map((customer) => [customer.id, customer.providerCustomerId]),
    );
    const employeeWalletByOwnerNetwork = new Map(
      employeeWallets.map((wallet) => [`${wallet.userId}:${wallet.network}`, wallet]),
    );
    const orgWalletByNetwork = new Map(orgWallets.map((wallet) => [wallet.network, wallet]));
    const employeeCustomerIds = [
      ...new Set(externalAccounts.map((account) => account.providerCustomerId)),
    ];
    const employeeCustomers = employeeCustomerIds.length
      ? await this.customers.find({
          where: { id: In(employeeCustomerIds), provider: 'bridge', ownerType: 'employee' },
          select: { id: true, providerCustomerId: true, userId: true },
        })
      : [];
    const employeeCustomerById = new Map(
      employeeCustomers.map((customer) => [customer.id, customer.providerCustomerId]),
    );
    const planFeePercentage = await this.payrollFees.getPayrollFeePercentage(tenantId);
    if (planFeePercentage > 0 && !isBridgeDeveloperFeeCollectionEnabled()) {
      throw new ServiceUnavailableException(
        'Bridge developer fee settlement is not configured for PaqadHR.',
      );
    }
    const providerBalances = await this.bridgeWallets.getWalletBalances({
      ownerType: 'organization',
      tenantId,
      userId: null,
    });
    const remainingProviderUnits = new Map(
      providerBalances.map((balance) => [
        `${balance.currency}:${balance.network}`,
        this.helper.amountUnits(balance.balance),
      ]),
    );
    const settledOperations = items.length
      ? await this.operations.find({
          where: {
            tenantId,
            payrollItemId: In(items.map((item) => item.id)),
            provider: 'bridge',
            kind: 'transfer',
            status: 'completed',
          },
          select: { id: true, payrollItemId: true, metadata: true, updatedAt: true },
          order: { updatedAt: 'DESC' },
        })
      : [];
    const settledBankTransferByItem = new Map<string, WalletOperation>();
    for (const operation of settledOperations) {
      if (
        operation.payrollItemId &&
        operation.metadata?.payoutMode === 'bank' &&
        !settledBankTransferByItem.has(operation.payrollItemId)
      ) {
        settledBankTransferByItem.set(operation.payrollItemId, operation);
      }
    }

    return {
      country,
      userByMember,
      externalAccountByMethod,
      orgWalletByNetwork,
      employeeWalletByOwnerNetwork,
      customerById,
      employeeCustomerById,
      planFeePercentage,
      remainingProviderUnits,
      settledBankTransferByItem,
    };
  }

  async fundItemRoute(
    input: RunPayoutContext & {
      item: PayrollItem;
      currency: string;
      tenantId: string;
      fxRates: Map<string, Promise<{ sellRate: string; updatedAt: string }>>;
    },
  ) {
    const {
      externalAccountByMethod,
      planFeePercentage,
      remainingProviderUnits,
      item,
      currency,
      tenantId,
      fxRates,
    } = input;
    const externalAccount = externalAccountByMethod.get(item.paymentMethodId ?? '');
    const sourceCurrency =
      currency === 'USDC' || currency === 'USDT' ? currency : externalAccount?.sourceCurrency;
    const network =
      currency === 'USDC' || currency === 'USDT'
        ? this.helper.readNetwork(item)
        : (externalAccount?.network ?? '');
    const amount = this.helper.amountString(item);
    let bankFunding:
      | {
          walletAmount: string;
          planFeeAmount: string;
          sourceAmount: string;
          exchangeRate: string;
          rateUpdatedAt: string;
        }
      | undefined;
    if (sourceCurrency && (currency === 'USDC' || currency === 'USDT')) {
      const key = `${sourceCurrency}:${network}`;
      const balance = remainingProviderUnits.get(key) ?? 0n;
      const amountUnits = amount ? this.helper.amountUnits(amount) : 0n;
      const feeAmount = amount ? this.helper.calculatePlanFee(amount, planFeePercentage) : null;
      if (!amount || amountUnits <= 0n || feeAmount === null) {
        return this.helper.failItem(
          item,
          tenantId,
          'Payroll payout amount or plan-based fee is invalid or requires an unsupported FX conversion.',
        );
      }
      const requiredUnits = this.helper.amountUnits(this.helper.addAmounts(amount, feeAmount));
      if (requiredUnits > balance) {
        return this.helper.failItem(
          item,
          tenantId,
          `Organization Bridge wallet has insufficient ${currency} on ${network} to cover salary and plan fees.`,
        );
      }
      remainingProviderUnits.set(key, balance - requiredUnits);
    } else if (sourceCurrency && externalAccount && amount) {
      const pairKey = `${currency}:${sourceCurrency}`;
      let ratePromise = fxRates.get(pairKey);
      if (!ratePromise) {
        ratePromise = this.helper.getBridgeSellRate(currency, sourceCurrency);
        fxRates.set(pairKey, ratePromise);
      }
      try {
        const rate = await ratePromise;
        const salaryWalletAmount = multiplyMoneyByRate(amount, rate.sellRate, 6);
        const walletAmount = salaryWalletAmount
          ? multiplyMoneyByRate(salaryWalletAmount, '1.01', 6)
          : null;
        const fiatFee = this.helper.calculatePlanFee(amount, planFeePercentage);
        const planFeeAmount = fiatFee ? multiplyMoneyByRate(fiatFee, rate.sellRate, 2) : null;
        const sourceAmount =
          walletAmount && planFeeAmount ? addMoneyAmounts(walletAmount, planFeeAmount) : null;
        if (!walletAmount || !planFeeAmount || !sourceAmount) {
          throw new BadRequestException('Bridge payroll FX amount could not be calculated safely.');
        }
        bankFunding = {
          walletAmount,
          planFeeAmount,
          sourceAmount,
          exchangeRate: rate.sellRate,
          rateUpdatedAt: rate.updatedAt,
        };
        const balanceKey = `${sourceCurrency}:${network}`;
        const balance = remainingProviderUnits.get(balanceKey) ?? 0n;
        const requiredUnits = this.helper.amountUnits(sourceAmount);
        if (requiredUnits > balance) {
          return this.helper.failItem(
            item,
            tenantId,
            `Organization Bridge wallet has insufficient ${sourceCurrency} on ${network} to cover salary, FX buffer, and plan fees.`,
          );
        }
        remainingProviderUnits.set(balanceKey, balance - requiredUnits);
      } catch (error) {
        return this.helper.failItem(
          item,
          tenantId,
          error instanceof Error ? error.message : 'Bridge FX route is unavailable.',
        );
      }
    } else {
      return this.helper.failItem(
        item,
        tenantId,
        'A valid Bridge payroll route and amount are required.',
      );
    }
    return { externalAccount, currency, network, bankFunding };
  }
}
