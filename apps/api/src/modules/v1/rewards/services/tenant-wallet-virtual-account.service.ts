import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { MonnifyApiService } from 'src/common/services/monnify-api.service';
import { resolveNgPaymentProvider } from 'src/common/utils/ng-money-provider.util';
import { DataSource, Repository } from 'typeorm';
import { NombaApiService } from '../../subscriptions/services/nomba-api.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import {
  isRewardsWalletVirtualAccountLive,
  resolveRewardsWalletVirtualAccountProvider,
  rewardsWalletVirtualAccountProviderLabel,
} from '../config/rewards-wallet-provider.config';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import { TenantWalletService } from './tenant-wallet.service';

export interface RewardsVirtualAccountDetails {
  supported: boolean;
  provider: 'nomba' | 'monnify' | null;
  providerLabel: string | null;
  live: boolean | null;
  ready: boolean;
  providerMismatch: boolean;
  status: string | null;
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  reference: string | null;
  error: string | null;
  requirements: string[];
  provisionedAt: Date | null;
}

export interface RewardsVirtualAccountDepositInput {
  provider: PaymentProvider;
  amount: number;
  transactionReference: string;
  accountReference?: string | null;
  accountNumber?: string | null;
  paymentReference?: string | null;
  payerName?: string | null;
  rawPayload: Record<string, unknown>;
}

@Injectable()
export class TenantWalletVirtualAccountService {
  private readonly logger = new Logger(TenantWalletVirtualAccountService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly walletService: TenantWalletService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly nombaApi: NombaApiService,
    private readonly monnifyApi: MonnifyApiService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async describeVirtualAccount(
    tenantId: string,
    wallet?: TenantWallet,
  ): Promise<RewardsVirtualAccountDetails> {
    const currentWallet = wallet ?? (await this.walletService.ensureWallet(tenantId));
    const provider = resolveRewardsWalletVirtualAccountProvider(currentWallet.currencyCode);

    if (currentWallet.currencyCode.toUpperCase() !== 'NGN') {
      return {
        supported: false,
        provider: null,
        providerLabel: null,
        live: null,
        ready: false,
        providerMismatch: false,
        status: 'unsupported',
        accountName: null,
        accountNumber: null,
        bankName: null,
        reference: null,
        error: 'Virtual accounts are available only for NGN rewards wallets.',
        requirements: [],
        provisionedAt: null,
      };
    }

    const requirements = await this.resolveProvisioningRequirements(tenantId, provider);
    const providerMismatch =
      Boolean(currentWallet.virtualAccountProvider) &&
      Boolean(provider) &&
      currentWallet.virtualAccountProvider !== provider;

    return {
      supported: provider !== null,
      provider: provider as 'nomba' | 'monnify' | null,
      providerLabel: rewardsWalletVirtualAccountProviderLabel(provider),
      live: isRewardsWalletVirtualAccountLive(provider),
      ready:
        !providerMismatch &&
        currentWallet.virtualAccountProvider === provider &&
        Boolean(currentWallet.virtualAccountNumber),
      providerMismatch,
      status: providerMismatch
        ? 'update_required'
        : (currentWallet.virtualAccountStatus ?? (provider ? 'PENDING' : 'UNAVAILABLE')),
      accountName: providerMismatch ? null : currentWallet.virtualAccountName,
      accountNumber: providerMismatch ? null : currentWallet.virtualAccountNumber,
      bankName: providerMismatch ? null : currentWallet.virtualAccountBank,
      reference: providerMismatch ? null : currentWallet.virtualAccountReference,
      error: providerMismatch
        ? 'Payment provider was updated. Create a new bank account to receive transfers.'
        : currentWallet.virtualAccountError,
      requirements,
      provisionedAt: providerMismatch ? null : currentWallet.virtualAccountProvisionedAt,
    };
  }

  async provisionVirtualAccount(tenantId: string): Promise<TenantWallet> {
    const wallet = await this.walletService.ensureWallet(tenantId);
    const provider = resolveRewardsWalletVirtualAccountProvider(wallet.currencyCode);

    if (wallet.currencyCode.toUpperCase() !== 'NGN') {
      throw new BadRequestException('Virtual accounts are available only for NGN rewards wallets');
    }
    if (!provider) {
      throw new BadRequestException('Virtual account funding is not configured');
    }

    const { tenant, billingContactEmail, billingContactName, identityBvn, identityNin } =
      await this.resolveTenantFundingProfile(tenantId);
    const requirements = await this.resolveProvisioningRequirements(tenantId, provider);
    if (requirements.length > 0) {
      throw new BadRequestException(requirements[0]);
    }

    try {
      const accountReference = this.resolveAccountReference(wallet, provider);
      const accountName = this.formatAccountName(tenant.name);
      let resolvedReference = accountReference;
      let accountNumber = '';
      let bankName = '';
      let resolvedAccountName = accountName;

      if (provider === PaymentProvider.MONNIFY) {
        const provisioned = await this.monnifyApi.createReservedAccount({
          accountReference,
          accountName,
          customerName: billingContactName,
          customerEmail: billingContactEmail,
          customerBvn: identityBvn,
          customerNin: identityNin,
        });
        resolvedReference = provisioned.accountReference;
        accountNumber = provisioned.accountNumber;
        bankName = provisioned.bankName;
        resolvedAccountName = provisioned.accountName;
      } else {
        const provisioned = await this.nombaApi.createVirtualAccount({
          accountRef: accountReference,
          accountName,
          customerName: billingContactName,
          customerEmail: billingContactEmail,
          bvn: identityBvn,
        });
        resolvedReference = provisioned.accountRef;
        accountNumber = provisioned.accountNumber;
        bankName = provisioned.bankName;
        resolvedAccountName = provisioned.accountName;
      }

      wallet.virtualAccountProvider = provider;
      wallet.virtualAccountReference = resolvedReference;
      wallet.virtualAccountNumber = accountNumber;
      wallet.virtualAccountBank = bankName;
      wallet.virtualAccountName = resolvedAccountName;
      wallet.virtualAccountStatus = 'ACTIVE';
      wallet.virtualAccountError = null;
      wallet.virtualAccountProvisionedAt = new Date();

      return this.dataSource.getRepository(TenantWallet).save(wallet);
    } catch (error) {
      wallet.virtualAccountProvider = provider;
      wallet.virtualAccountStatus = 'ERROR';
      wallet.virtualAccountError = error instanceof Error ? error.message : String(error);
      await this.dataSource
        .getRepository(TenantWallet)
        .save(wallet)
        .catch(() => undefined);
      throw error;
    }
  }

  async completeVirtualAccountDeposit(
    input: RewardsVirtualAccountDepositInput,
  ): Promise<{ received: boolean; credited: boolean }> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { received: true, credited: false };
    }

    const existing = await this.dataSource.getRepository(TenantWalletTransaction).findOne({
      where: { reference: input.transactionReference },
    });
    if (existing) {
      return { received: true, credited: false };
    }

    const walletRepo = this.dataSource.getRepository(TenantWallet);
    let wallet: TenantWallet | null = null;

    if (input.accountReference) {
      wallet = await walletRepo.findOne({
        where: { virtualAccountReference: input.accountReference },
      });
    }
    if (!wallet && input.accountNumber) {
      wallet = await walletRepo.findOne({
        where: { virtualAccountNumber: input.accountNumber },
      });
    }

    if (!wallet) {
      this.logger.warn(
        `Unmatched rewards virtual-account deposit ${input.transactionReference} (${input.accountReference || input.accountNumber || 'unknown account'})`,
      );
      return { received: true, credited: false };
    }

    if (wallet.virtualAccountProvider && wallet.virtualAccountProvider !== input.provider) {
      this.logger.warn(
        `Ignored deposit ${input.transactionReference} for wallet ${wallet.id}: provider ${input.provider} != stored ${wallet.virtualAccountProvider}`,
      );
      return { received: true, credited: false };
    }

    return this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(TenantWallet)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id', { id: wallet?.id })
        .getOneOrFail();

      const duplicate = await manager.getRepository(TenantWalletTransaction).findOne({
        where: { reference: input.transactionReference },
      });
      if (duplicate) {
        return { received: true, credited: false };
      }

      await this.walletService.credit(
        wallet!.tenantId,
        input.amount,
        'DEPOSIT',
        input.transactionReference,
        'Rewards wallet top-up via bank transfer',
        manager,
        {
          rawAmount: input.amount,
          metadata: {
            source: 'virtual_account',
            provider: input.provider,
            accountNumber: input.accountNumber ?? null,
            accountReference: input.accountReference ?? null,
            paymentReference: input.paymentReference ?? null,
            payerName: input.payerName ?? null,
            rawPayload: input.rawPayload,
          },
        },
      );
      return { received: true, credited: true };
    });
  }

  private resolveAccountReference(wallet: TenantWallet, provider: PaymentProvider): string {
    if (wallet.virtualAccountProvider === provider && wallet.virtualAccountReference) {
      return wallet.virtualAccountReference;
    }

    const tenantKey = wallet.tenantId.replace(/-/g, '').slice(0, 10);
    const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
    const prefix = provider === PaymentProvider.MONNIFY ? 'mon' : 'nom';
    return `rw_${prefix}_${tenantKey}_${suffix}`;
  }

  private formatAccountName(tenantName: string): string {
    const trimmed = tenantName.trim();
    return trimmed.length > 40 ? trimmed.slice(0, 40) : trimmed;
  }

  private async resolveProvisioningRequirements(
    tenantId: string,
    provider: PaymentProvider | null,
  ): Promise<string[]> {
    if (!provider) {
      return ['Configure an NGN payment provider first.'];
    }

    const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const billing = settings.settings.billing ?? {};
    const { billingContactEmail, identityBvn, identityNin } =
      await this.resolveTenantFundingProfile(tenantId);
    const requirements: string[] = [];

    if (!billingContactEmail) {
      requirements.push('Billing contact email is required. Add it in Settings → Billing.');
    }

    const requireKyc = billing.requireWorkspaceKycForVirtualAccounts === true;
    const monnifyActive = resolveNgPaymentProvider() === PaymentProvider.MONNIFY;
    const needsIdentity = monnifyActive || requireKyc;

    if (needsIdentity && !identityBvn && !identityNin) {
      requirements.push(
        'Add a workspace BVN or NIN in Settings → Billing → Identity verification.',
      );
    }

    if (provider === PaymentProvider.MONNIFY && !identityBvn && !identityNin) {
      requirements.push(
        'Add a workspace BVN or NIN in Settings → Billing → Identity verification.',
      );
    }

    return [...new Set(requirements)];
  }

  private async resolveTenantFundingProfile(tenantId: string): Promise<{
    tenant: Tenant;
    billingContactEmail: string;
    billingContactName: string;
    identityBvn?: string;
    identityNin?: string;
  }> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      relations: ['createdBy'],
    });
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const billing = settings.settings.billing ?? {};
    const billingContactEmail =
      billing.contactEmail?.trim() || tenant.createdBy?.email?.trim() || '';
    const billingContactName = billing.contactName?.trim() || tenant.name.trim();
    const identityBvn = (billing.identityBvn ?? billing.monnifyBvn)?.trim();
    const identityNin = (billing.identityNin ?? billing.monnifyNin)?.trim();

    return {
      tenant,
      billingContactEmail,
      billingContactName,
      identityBvn,
      identityNin,
    };
  }
}
