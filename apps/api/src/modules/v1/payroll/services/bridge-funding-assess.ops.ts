import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { ProviderExternalAccount } from '../../wallets/entities/provider-external-account.entity';
import { BridgeWalletService } from '../../wallets/services/bridge-wallet.service';
import { PayrollRun } from '../entities/payroll-run.entity';
import { addMoneyAmounts, multiplyMoneyByRate } from '../utils/payroll-platform-fee.util';
import { BridgeHelperOps } from './bridge-helper.ops';
import { WALLET_FACTOR, WALLET_SCALE } from './bridge-payroll-payout.shared';
import { PayrollFeeService } from './payroll-fee.service';

export class BridgeFundingAssessOps {
  constructor(
    private readonly bridgeWallets: BridgeWalletService,
    private readonly payrollFees: PayrollFeeService,
    @InjectRepository(ProviderExternalAccount)
    private readonly externalAccounts: Repository<ProviderExternalAccount>,
    private readonly helper: BridgeHelperOps,
  ) {}

  /** Calculate the source wallet assets needed for this run, using the same FX buffer and fee
   * rules as payout submission. This is a balance preflight only; the FX rate is indicative. */
  async assessFundingRequirement(
    run: PayrollRun,
    tenantId: string,
  ): Promise<{
    available: boolean;
    requirements: Array<{
      currency: string;
      network: string;
      requiredAmount: string;
      availableBalance: string;
      shortfall: string;
    }>;
    message?: string;
  }> {
    const items = (run.items ?? []).filter(
      (item) =>
        (item.status === PayrollItemStatus.PENDING || item.status === PayrollItemStatus.FAILED) &&
        item.metadata?.excludedFromRun !== true,
    );
    const memberIds = [...new Set(items.map((item) => item.memberId))];
    const paymentMethodIds = [
      ...new Set(items.map((item) => item.paymentMethodId).filter(Boolean)),
    ];
    const accounts = paymentMethodIds.length
      ? await this.externalAccounts.find({
          where: {
            tenantId,
            memberId: In(memberIds),
            paymentMethodId: In(paymentMethodIds),
            provider: 'bridge',
            status: 'active',
          },
          select: { memberId: true, paymentMethodId: true, sourceCurrency: true, network: true },
        })
      : [];
    const accountByMethod = new Map(accounts.map((account) => [account.paymentMethodId, account]));
    const balances = await this.bridgeWallets.getWalletBalances({
      ownerType: 'organization',
      tenantId,
      userId: null,
    });
    const balanceUnits = new Map<string, bigint>();
    for (const balance of balances) {
      const key = `${balance.currency}:${balance.network}`;
      balanceUnits.set(
        key,
        (balanceUnits.get(key) ?? 0n) + this.helper.amountUnits(balance.balance),
      );
    }
    const requiredUnits = new Map<string, bigint>();
    const planFeePercentage = await this.payrollFees.getPayrollFeePercentage(tenantId);
    const rates = new Map<string, Promise<{ sellRate: string; updatedAt: string }>>();
    try {
      for (const item of items) {
        const destination = item.paymentCurrency?.toUpperCase() ?? '';
        const account = accountByMethod.get(item.paymentMethodId ?? '');
        const source =
          destination === 'USDC' || destination === 'USDT'
            ? destination
            : account?.sourceCurrency?.toUpperCase();
        const network =
          destination === 'USDC' || destination === 'USDT'
            ? this.helper.readNetwork(item)
            : account?.network?.toUpperCase();
        const amount = this.helper.amountString(item);
        if (!source || !network || !amount || this.helper.amountUnits(amount) <= 0n) {
          return {
            available: false,
            requirements: [],
            message: `A valid Bridge source wallet and payout route are missing for payroll item ${item.id}.`,
          };
        }
        let sourceAmount: string | null;
        if (destination === 'USDC' || destination === 'USDT') {
          const fee = this.helper.calculatePlanFee(amount, planFeePercentage);
          sourceAmount = fee ? addMoneyAmounts(amount, fee) : null;
        } else {
          const key = `${destination}:${source}`;
          let rate = rates.get(key);
          if (!rate) {
            rate = this.helper.getBridgeSellRate(destination, source);
            rates.set(key, rate);
          }
          const quote = await rate;
          const salary = multiplyMoneyByRate(amount, quote.sellRate, 6);
          const withBuffer = salary ? multiplyMoneyByRate(salary, '1.01', 6) : null;
          const fee = this.helper.calculatePlanFee(amount, planFeePercentage);
          const sourceFee = fee ? multiplyMoneyByRate(fee, quote.sellRate, 2) : null;
          sourceAmount = withBuffer && sourceFee ? addMoneyAmounts(withBuffer, sourceFee) : null;
        }
        if (!sourceAmount) {
          return {
            available: false,
            requirements: [],
            message: `Could not safely calculate required ${source} for payroll item ${item.id}.`,
          };
        }
        const key = `${source}:${network}`;
        requiredUnits.set(
          key,
          (requiredUnits.get(key) ?? 0n) + this.helper.amountUnits(sourceAmount),
        );
      }
    } catch (error) {
      return {
        available: false,
        requirements: [],
        message:
          error instanceof Error
            ? `Bridge funding requirement unavailable: ${error.message}`
            : 'Bridge funding requirement unavailable.',
      };
    }
    const requirements = [...requiredUnits.entries()].map(([key, units]) => {
      const [currency, network] = key.split(':');
      const available = balanceUnits.get(key) ?? 0n;
      const fixed = (value: bigint) => {
        const whole = (value / WALLET_FACTOR).toString();
        const fraction = (value % WALLET_FACTOR)
          .toString()
          .padStart(Number(WALLET_SCALE), '0')
          .replace(/0+$/, '');
        return fraction ? `${whole}.${fraction}` : whole;
      };
      return {
        currency,
        network,
        requiredAmount: fixed(units),
        availableBalance: fixed(available),
        shortfall: fixed(units > available ? units - available : 0n),
      };
    });
    return {
      available: requirements.every((entry) => entry.shortfall === '0'),
      requirements,
    };
  }
}
