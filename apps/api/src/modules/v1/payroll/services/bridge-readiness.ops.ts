import { ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  assertBridgePayrollCapability,
  PayrollAsset,
} from 'src/common/config/bridge-payroll-capabilities.config';
import { isBridgeDeveloperFeeCollectionEnabled } from 'src/common/config/bridge.config';
import { In, Repository } from 'typeorm';

import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { CustodyWallet } from '../../wallets/entities/custody-wallet.entity';
import { ProviderExternalAccount } from '../../wallets/entities/provider-external-account.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { BridgeHelperOps } from './bridge-helper.ops';
import { PayrollFeeService } from './payroll-fee.service';

export class BridgeReadinessOps {
  constructor(
    private readonly payrollFees: PayrollFeeService,
    @InjectRepository(CustodyWallet) private readonly wallets: Repository<CustodyWallet>,
    @InjectRepository(ProviderExternalAccount)
    private readonly externalAccounts: Repository<ProviderExternalAccount>,
    @InjectRepository(TenantMember)
    private readonly members: Repository<TenantMember>,
    private readonly helper: BridgeHelperOps,
  ) {}

  async assessRunReadiness(
    run: PayrollRun,
    tenantId: string,
    scopedItems?: PayrollItem[],
  ): Promise<
    Array<{
      itemId: string;
      ready: boolean;
      message?: string;
      platformFeeAmount: string;
      platformFeePercentage: number;
    }>
  > {
    const country = run.tenant?.countryCode?.toUpperCase() ?? '';
    const items = (scopedItems ?? run.items ?? []).filter(
      (item) =>
        item.status !== PayrollItemStatus.CANCELLED && item.metadata?.excludedFromRun !== true,
    );
    const memberIds = [...new Set(items.map((item) => item.memberId))];
    const members = memberIds.length
      ? await this.members.find({
          where: { id: In(memberIds), tenantId },
          select: { id: true, userId: true },
        })
      : [];
    const userByMember = new Map(members.map((member) => [member.id, member.userId]));
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
    const organizationWallets = networks.length
      ? await this.wallets.find({
          where: {
            ownerType: 'organization',
            tenantId,
            provider: 'bridge',
            status: 'active',
            network: In(networks),
          },
          select: { network: true },
        })
      : [];
    const employeeWallets =
      members.length && networks.length
        ? await this.wallets.find({
            where: {
              ownerType: 'employee',
              userId: In(members.map((member) => member.userId)),
              provider: 'bridge',
              status: 'active',
              network: In(networks),
            },
            select: { userId: true, network: true },
          })
        : [];
    const organizationNetworks = new Set(organizationWallets.map((wallet) => wallet.network));
    const employeeWalletKeys = new Set(
      employeeWallets.map((wallet) => `${wallet.userId}:${wallet.network}`),
    );
    const planFeePercentage = await this.payrollFees.getPayrollFeePercentage(tenantId);

    return items.map((item) => {
      const currency = item.paymentCurrency?.toUpperCase() ?? '';
      const externalAccount = externalAccountByMethod.get(item.paymentMethodId ?? '');
      const network =
        currency === 'USDC' || currency === 'USDT'
          ? this.helper.readNetwork(item)
          : (externalAccount?.network ?? '');
      const sourceCurrency =
        currency === 'USDC' || currency === 'USDT' ? currency : externalAccount?.sourceCurrency;
      const userId = userByMember.get(item.memberId);
      const itemAmount = this.helper.amountString(item);
      const platformFeeAmount = itemAmount
        ? this.helper.calculatePlanFee(itemAmount, planFeePercentage)
        : null;
      let routeMessage: string | undefined;
      try {
        if (planFeePercentage > 0 && !isBridgeDeveloperFeeCollectionEnabled()) {
          throw new ServiceUnavailableException(
            'Bridge developer fee settlement is not configured for PaqadHR.',
          );
        }
        if (!sourceCurrency || !network) {
          throw new ServiceUnavailableException(
            'Link a Bridge bank account and choose its stablecoin wallet source before payroll.',
          );
        }
        assertBridgePayrollCapability({
          operation: 'wallet_transfer',
          sourceCurrency: sourceCurrency as PayrollAsset,
          currency: sourceCurrency as PayrollAsset,
          country,
          network,
        });
        if (currency !== 'USDC' && currency !== 'USDT') {
          if (
            !externalAccount ||
            externalAccount.userId !== userId ||
            externalAccount.currency !== currency
          ) {
            throw new ServiceUnavailableException(
              'Employee Bridge bank account is not linked for this payroll method.',
            );
          }
          assertBridgePayrollCapability({
            operation: 'withdrawal',
            sourceCurrency: sourceCurrency as PayrollAsset,
            currency: currency as PayrollAsset,
            country: externalAccount.country,
            network,
          });
        }
      } catch (error) {
        routeMessage =
          error instanceof Error ? error.message : 'Bridge payout route is unavailable.';
      }
      const ready =
        !routeMessage &&
        Boolean(userId) &&
        organizationNetworks.has(network) &&
        employeeWalletKeys.has(`${userId}:${network}`);
      return {
        itemId: item.id,
        ready,
        platformFeeAmount: platformFeeAmount ?? '0',
        platformFeePercentage: planFeePercentage,
        ...(!ready
          ? {
              message:
                routeMessage ??
                (!userId
                  ? 'Employee account link is missing.'
                  : !organizationNetworks.has(network)
                    ? 'Organization Bridge wallet is missing for this network.'
                    : 'Employee Bridge wallet is missing for this network.'),
            }
          : {}),
      };
    });
  }
}
