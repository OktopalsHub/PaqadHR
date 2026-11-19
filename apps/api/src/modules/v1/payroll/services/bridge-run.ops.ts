import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PaymentResult } from '../../../../common/interfaces/payment-result.interface';
import { WalletOperation } from '../../wallets/entities/wallet-operation.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { updatePayrollItemScopedIfStatus } from '../repositories/payroll-item-write.util';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { BridgeApplyOps } from './bridge-apply.ops';
import { BridgeRunContextOps } from './bridge-run-context.ops';
import { BridgeTransferSubmitOps } from './bridge-transfer-submit.ops';
import { PayrollPayoutService } from './payroll-payout.service';

export class BridgeRunOps {
  constructor(
    private readonly payrollPayouts: PayrollPayoutService,
    private readonly payrollItems: PayrollItemRepository,
    private readonly apply: BridgeApplyOps,
    private readonly runContext: BridgeRunContextOps,
    private readonly transferSubmit: BridgeTransferSubmitOps,
  ) {}

  async processRun(
    run: PayrollRun,
    items: PayrollItem[],
    tenantId: string,
  ): Promise<PaymentResult[]> {
    const context = await this.runContext.loadRunContext(run, items, tenantId);
    const {
      country,
      userByMember,
      orgWalletByNetwork,
      employeeWalletByOwnerNetwork,
      customerById,
      employeeCustomerById,
      planFeePercentage,
      settledBankTransferByItem,
    } = context;
    const results: PaymentResult[] = [];
    const fxRates = new Map<string, Promise<{ sellRate: string; updatedAt: string }>>();
    for (const item of items) {
      const currency = item.paymentCurrency?.toUpperCase() ?? '';
      const settledBankTransfer =
        item.status === PayrollItemStatus.FAILED
          ? settledBankTransferByItem.get(item.id)
          : undefined;
      if (settledBankTransfer) {
        results.push(await this.resumeSettledBankTransfer(item, settledBankTransfer, tenantId));
        continue;
      }
      const route = await this.runContext.fundItemRoute({
        ...context,
        item,
        currency,
        tenantId,
        fxRates,
      });
      if ('success' in route) {
        results.push(route);
        continue;
      }
      const { externalAccount, network, bankFunding } = route;
      results.push(
        await this.transferSubmit.processItem({
          run,
          item,
          tenantId,
          country,
          userId: userByMember.get(item.memberId),
          orgWallet: orgWalletByNetwork.get(network),
          employeeWallet: employeeWalletByOwnerNetwork.get(
            `${userByMember.get(item.memberId)}:${network}`,
          ),
          orgCustomerId: orgWalletByNetwork.get(network)
            ? customerById.get(orgWalletByNetwork.get(network)!.providerCustomerId)
            : null,
          planFeePercentage,
          ...(externalAccount && currency !== 'USDC' && currency !== 'USDT'
            ? {
                bankPayout: {
                  externalAccount,
                  employeeCustomerId:
                    employeeCustomerById.get(externalAccount.providerCustomerId) ?? undefined,
                  sourceCurrency: externalAccount.sourceCurrency,
                  network: externalAccount.network,
                  ...bankFunding,
                },
              }
            : {}),
        }),
      );
    }
    await this.payrollPayouts.reconcilePayrollRunStatus(run.id, tenantId);
    return results;
  }

  async resumeSettledBankTransfer(
    item: PayrollItem,
    settledBankTransfer: WalletOperation,
    tenantId: string,
  ): Promise<PaymentResult> {
    const claimed = await updatePayrollItemScopedIfStatus(
      this.payrollItems,
      item.id,
      tenantId,
      PayrollItemStatus.FAILED,
      { status: PayrollItemStatus.PROCESSING, failureReason: null },
    );
    if (!claimed) {
      return {
        success: false,
        outcome: 'failed',
        error: 'Payroll item is no longer eligible for retry.',
      };
    }
    await this.apply.startBankWithdrawal(settledBankTransfer, true);
    const latestItem = await this.payrollItems.findOne({
      where: { id: item.id },
      select: { id: true, status: true, transactionId: true },
    });
    return {
      success: latestItem?.status !== PayrollItemStatus.FAILED,
      outcome:
        latestItem?.status === PayrollItemStatus.PAID
          ? 'paid'
          : latestItem?.status === PayrollItemStatus.FAILED
            ? 'failed'
            : 'processing',
      transactionId: latestItem?.transactionId ?? undefined,
      reference: latestItem?.transactionId ?? undefined,
      provider: 'Bridge',
      rail: 'bank',
    };
  }
}
