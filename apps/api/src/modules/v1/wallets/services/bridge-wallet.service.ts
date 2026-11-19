import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

import { assertBridgePayrollCapability } from '../../../../common/config/bridge-payroll-capabilities.config';
import { PaymentProviderError } from '../../../../common/providers/payment-provider.interface';
import { BridgeApiService } from '../../../../common/services/bridge-api.service';
import type { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { parseUkIban } from '../../payment-method/utils/global-bank-validation.util';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { CustodyWallet } from '../entities/custody-wallet.entity';
import { ProviderCustomer, WalletOwnerType } from '../entities/provider-customer.entity';
import { ProviderExternalAccount } from '../entities/provider-external-account.entity';
import { ProviderVirtualAccount } from '../entities/provider-virtual-account.entity';

export interface WalletOwnerScope {
  ownerType: WalletOwnerType;
  tenantId: string | null;
  userId: string | null;
}

export interface WalletBalanceSnapshot {
  currency: string;
  network: string;
  balance: string;
}

export interface CustodyWalletView {
  id: string;
  network: string;
  address: string | null;
  status: string;
  createdAt: Date;
}

export interface BridgeVirtualAccountView {
  id: string;
  sourceCurrency: string;
  destinationCurrency: string;
  network: string;
  status: string;
  depositInstructions: Record<string, unknown>;
  createdAt: Date;
}

@Injectable()
export class BridgeWalletService {
  constructor(
    private readonly bridgeApi: BridgeApiService,
    private readonly paymentMethods: PaymentMethodService,
    @InjectRepository(ProviderCustomer)
    private readonly customerRepository: Repository<ProviderCustomer>,
    @InjectRepository(CustodyWallet)
    private readonly walletRepository: Repository<CustodyWallet>,
    @InjectRepository(ProviderVirtualAccount)
    private readonly virtualAccountRepository: Repository<ProviderVirtualAccount>,
    @InjectRepository(ProviderExternalAccount)
    private readonly externalAccountRepository: Repository<ProviderExternalAccount>,
    @InjectRepository(TenantMember)
    private readonly memberRepository: Repository<TenantMember>,
  ) {}

  async linkEmployeeExternalAccount(input: {
    tenantId: string;
    memberId: string;
    userId: string;
    country: string;
    paymentMethodId: string;
    sourceCurrency: 'USDC' | 'USDT';
    network: string;
  }): Promise<{
    id: string;
    currency: string;
    sourceCurrency: string;
    network: string;
    status: string;
  }> {
    const country = input.country.trim().toUpperCase();
    const network = input.network.trim().toUpperCase();
    const sourceCurrency = input.sourceCurrency;
    const method = await this.paymentMethods.findVerifiedPayoutMethodForBridge(
      input.tenantId,
      input.memberId,
      input.paymentMethodId,
    );
    if (String(method.type).toLowerCase() !== 'bank') {
      throw new BadRequestException('A verified bank payment method is required.');
    }
    const currency = method.currency?.toUpperCase();
    if (currency !== 'USD' && currency !== 'EUR' && currency !== 'GBP') {
      throw new BadRequestException('Bridge bank payouts currently support USD, EUR, and GBP.');
    }
    const capability = assertBridgePayrollCapability({
      operation: 'withdrawal',
      sourceCurrency,
      currency,
      country,
      network,
    });
    if (!capability.bridgeCurrency || !capability.bridgePaymentRail) {
      throw new ConflictException('Bridge withdrawal route mapping is not configured.');
    }

    const member = await this.memberRepository.findOne({
      where: { id: input.memberId, tenantId: input.tenantId, userId: input.userId },
      relations: { address: true },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        firstName: true,
        lastName: true,
        address: {
          id: true,
          street: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
        },
      },
    });
    if (!member) throw new NotFoundException('Employee membership was not found.');
    const firstName = member.firstName?.trim();
    const lastName = member.lastName?.trim();
    const address = member.address;
    if (!firstName || !lastName || !address?.street?.trim() || !address.city?.trim()) {
      throw new BadRequestException(
        'Employee legal name and residential address are required to link a Bridge bank account.',
      );
    }
    const addressCountry = this.toIso3Country(address.country, country);
    const addressPayload = {
      street_line_1: address.street.trim(),
      city: address.city.trim(),
      state: address.state?.trim() || undefined,
      postal_code: address.postalCode?.trim() || undefined,
      country: addressCountry,
    };
    const accountPayload = this.buildExternalAccountPayload({
      method,
      firstName,
      lastName,
      address: addressPayload,
    });
    const fingerprint = createHash('sha256').update(JSON.stringify(accountPayload)).digest('hex');
    const owner: WalletOwnerScope = { ownerType: 'employee', tenantId: null, userId: input.userId };
    const customer = await this.findCustomer(owner);
    if (
      !customer?.providerCustomerId ||
      customer.status !== 'approved' ||
      customer.kycStatus !== 'approved' ||
      customer.termsStatus !== 'approved'
    ) {
      throw new ConflictException('Complete and verify Bridge employee onboarding first.');
    }

    // A bank payroll destination is usable only when the employee also has a Bridge wallet
    // on the selected asset network. createWallet is idempotent for the owner/network pair.
    await this.createWallet({
      owner,
      country,
      currency: sourceCurrency,
      network,
    });

    const existing = await this.externalAccountRepository.findOne({
      where: { paymentMethodId: method.id, provider: 'bridge' },
    });
    if (existing?.fingerprint === fingerprint && existing.currency === currency) {
      existing.sourceCurrency = sourceCurrency;
      existing.country = country;
      existing.network = network;
      existing.status = 'active';
      const saved = await this.externalAccountRepository.save(existing);
      return this.toExternalAccountView(saved);
    }

    const remote = await this.bridgeApi.createExternalAccount(
      customer.providerCustomerId,
      accountPayload,
      this.idempotencyKey(`external-account-${method.id}-${fingerprint}`, owner),
    );
    if (typeof remote.id !== 'string' || !remote.id || remote.active !== true) {
      throw new PaymentProviderError(
        'Bridge did not activate the employee bank account.',
        'INVALID_RESPONSE',
      );
    }
    const record = this.externalAccountRepository.create({
      tenantId: input.tenantId,
      memberId: input.memberId,
      userId: input.userId,
      paymentMethodId: method.id,
      providerCustomerId: customer.id,
      provider: 'bridge',
      providerExternalAccountId: remote.id,
      currency,
      country,
      sourceCurrency,
      network,
      status: 'active',
      fingerprint,
    });
    try {
      const saved = existing
        ? await this.externalAccountRepository.save({ ...existing, ...record })
        : await this.externalAccountRepository.save(record);
      return this.toExternalAccountView(saved);
    } catch (error) {
      const concurrent = await this.externalAccountRepository.findOne({
        where: { paymentMethodId: method.id, provider: 'bridge' },
      });
      if (concurrent?.fingerprint === fingerprint) return this.toExternalAccountView(concurrent);
      throw error;
    }
  }

  async createOnboardingLink(input: {
    owner: WalletOwnerScope;
    fullName: string;
    email: string;
  }): Promise<{ customerId: string; kycLink: string; termsLink: string }> {
    const owner = this.validateOwner(input.owner);
    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    if (!fullName || fullName.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('A valid name and email are required for Bridge onboarding.');
    }
    const payload = {
      full_name: fullName,
      email,
      type: owner.ownerType === 'organization' ? 'business' : 'individual',
    };
    const response = await this.bridgeApi.createKycLink(
      payload,
      this.idempotencyKey('kyc-link', owner),
    );
    const providerKycLinkId = response.id;
    const kycLink = response.kyc_link;
    const termsLink = response.tos_link;
    if (
      typeof providerKycLinkId !== 'string' ||
      !providerKycLinkId ||
      typeof kycLink !== 'string' ||
      typeof termsLink !== 'string'
    ) {
      throw new PaymentProviderError(
        'Bridge returned incomplete onboarding links.',
        'INVALID_RESPONSE',
      );
    }

    const existing = await this.findCustomer(owner);
    if (existing) {
      if (existing.providerKycLinkId !== providerKycLinkId) {
        throw new ConflictException('Bridge onboarding is linked to a different customer.');
      }
      return { customerId: existing.id, kycLink, termsLink };
    }

    const customer = this.customerRepository.create({
      ...owner,
      provider: 'bridge',
      providerCustomerId: null,
      providerKycLinkId,
      status: 'pending',
      kycStatus: 'not_started',
      kybStatus: null,
      termsStatus: 'pending',
      metadata: null,
    });
    try {
      const saved = await this.customerRepository.save(customer);
      return { customerId: saved.id, kycLink, termsLink };
    } catch (error) {
      const concurrent = await this.findCustomer(owner);
      if (concurrent) {
        if (concurrent.providerKycLinkId === providerKycLinkId) {
          return { customerId: concurrent.id, kycLink, termsLink };
        }
        throw new ConflictException('Bridge onboarding was linked to a different customer.');
      }
      throw error;
    }
  }

  async refreshCustomerStatus(
    ownerInput: WalletOwnerScope,
  ): Promise<Pick<ProviderCustomer, 'status' | 'kycStatus' | 'kybStatus' | 'termsStatus'>> {
    const owner = this.validateOwner(ownerInput);
    const customer = await this.findCustomer(owner);
    if (!customer) throw new NotFoundException('Bridge customer onboarding was not found.');
    if (!customer.providerKycLinkId) {
      throw new ConflictException('Bridge onboarding link reference is missing.');
    }
    const kycLink = await this.bridgeApi.getKycLink(customer.providerKycLinkId);
    if (typeof kycLink.customer_id === 'string' && kycLink.customer_id) {
      customer.providerCustomerId = kycLink.customer_id;
    }
    const remoteCustomer = customer.providerCustomerId
      ? await this.bridgeApi.getCustomer(customer.providerCustomerId)
      : null;
    const kycStatus =
      this.readStatus(remoteCustomer?.kyc_status) ?? this.readStatus(kycLink.kyc_status);
    const kybStatus =
      this.readStatus(remoteCustomer?.kyb_status) ?? this.readStatus(kycLink.kyb_status);
    const termsStatus =
      this.readStatus(remoteCustomer?.tos_status) ?? this.readStatus(kycLink.tos_status);
    customer.kycStatus = kycStatus;
    customer.kybStatus = kybStatus;
    customer.termsStatus = termsStatus;
    const verificationStatus =
      owner.ownerType === 'organization' ? (kybStatus ?? kycStatus) : kycStatus;
    const providerStatus = this.readStatus(remoteCustomer?.status);
    customer.status =
      (verificationStatus === 'approved' || providerStatus === 'active') &&
      termsStatus === 'approved'
        ? 'approved'
        : (verificationStatus ?? providerStatus ?? 'pending');
    const saved = await this.customerRepository.save(customer);
    return {
      status: saved.status,
      kycStatus: saved.kycStatus,
      kybStatus: saved.kybStatus,
      termsStatus: saved.termsStatus,
    };
  }

  async createWallet(input: {
    owner: WalletOwnerScope;
    country: string;
    currency: 'USDC' | 'USDT';
    network: string;
  }): Promise<CustodyWalletView> {
    const owner = this.validateOwner(input.owner);
    const country = input.country.trim().toUpperCase();
    const currency = input.currency;
    const network = input.network.trim().toUpperCase();
    const capability = assertBridgePayrollCapability({
      operation: 'wallet_creation',
      sourceCurrency: currency,
      currency,
      country,
      network,
    });
    if (!capability.bridgeChain) {
      throw new ConflictException('Bridge chain mapping is not configured for this wallet route.');
    }
    const customer = await this.findCustomer(owner);
    if (!customer)
      throw new NotFoundException('Complete Bridge onboarding before creating a wallet.');
    const existing = await this.walletRepository.findOne({
      where: { ...this.ownerWhere(owner), provider: 'bridge', network },
    });
    if (existing) return this.toWalletView(existing);

    const onboardingStatus = await this.refreshCustomerStatus(owner);
    const refreshedCustomer = await this.findCustomer(owner);
    if (onboardingStatus.status !== 'approved' || !refreshedCustomer?.providerCustomerId) {
      throw new ConflictException(
        'Bridge identity verification and terms acceptance must be approved first.',
      );
    }

    const remoteWallet = await this.bridgeApi.createWallet(
      refreshedCustomer.providerCustomerId,
      capability.bridgeChain,
      this.idempotencyKey(`wallet-${network}`, owner),
    );
    const wallet = this.walletRepository.create({
      ...owner,
      providerCustomerId: customer.id,
      provider: 'bridge',
      providerWalletId: remoteWallet.id,
      network,
      address: typeof remoteWallet.address === 'string' ? remoteWallet.address : null,
      status: 'active',
      metadata: null,
    });
    try {
      return this.toWalletView(await this.walletRepository.save(wallet));
    } catch (error) {
      const concurrent = await this.walletRepository.findOne({
        where: { ...this.ownerWhere(owner), provider: 'bridge', network },
      });
      if (concurrent) return this.toWalletView(concurrent);
      throw error;
    }
  }

  async getWalletBalances(ownerInput: WalletOwnerScope): Promise<WalletBalanceSnapshot[]> {
    const owner = this.validateOwner(ownerInput);
    const wallets = await this.walletRepository.find({
      where: { ...this.ownerWhere(owner), provider: 'bridge', status: 'active' },
      select: {
        id: true,
        providerCustomerId: true,
        providerWalletId: true,
        network: true,
        createdAt: true,
      },
      order: { createdAt: 'ASC' },
      take: 50,
    });
    const providerCustomerRows = await this.customerRepository.find({
      where: {
        id: In([...new Set(wallets.map((wallet) => wallet.providerCustomerId))]),
        ...this.ownerWhere(owner),
        provider: 'bridge',
      },
      select: { id: true, providerCustomerId: true },
    });
    const customers = new Map(
      providerCustomerRows
        .filter((customer) => customer.providerCustomerId)
        .map((customer) => [customer.id, customer.providerCustomerId as string]),
    );
    const results: WalletBalanceSnapshot[] = [];
    if (customers.size !== new Set(wallets.map((wallet) => wallet.providerCustomerId)).size) {
      throw new ConflictException('Wallet is not linked to a completed Bridge customer.');
    }
    for (let offset = 0; offset < wallets.length; offset += 4) {
      const batch = await Promise.all(
        wallets.slice(offset, offset + 4).map(async (wallet) => {
          const providerCustomerId = customers.get(wallet.providerCustomerId);
          if (!providerCustomerId) {
            throw new ConflictException('Wallet is not linked to this owner.');
          }
          return this.bridgeApi.getWallet(providerCustomerId, wallet.providerWalletId);
        }),
      );
      for (let batchIndex = 0; batchIndex < batch.length; batchIndex++) {
        const remote = batch[batchIndex];
        const wallet = wallets[offset + batchIndex];
        if (!Array.isArray(remote.balances)) {
          throw new PaymentProviderError(
            'Bridge returned an invalid wallet balance response.',
            'INVALID_RESPONSE',
          );
        }
        for (const item of remote.balances) {
          if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new PaymentProviderError(
              'Bridge returned an invalid wallet asset balance.',
              'INVALID_RESPONSE',
            );
          }
          const balance = item as Record<string, unknown>;
          if (
            typeof balance.currency !== 'string' ||
            typeof balance.balance !== 'string' ||
            !/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(balance.balance)
          ) {
            throw new PaymentProviderError(
              'Bridge returned an invalid wallet asset balance.',
              'INVALID_RESPONSE',
            );
          }
          results.push({
            currency: balance.currency.toUpperCase(),
            // Expose the application route key (e.g. SOL) consistently with payroll metadata.
            network: wallet.network,
            balance: balance.balance,
          });
        }
      }
    }
    return results;
  }

  async createVirtualAccount(input: {
    owner: WalletOwnerScope;
    country: string;
    sourceCurrency: 'USD' | 'EUR' | 'GBP' | 'NGN';
    destinationCurrency: 'USDC' | 'USDT';
    network: string;
  }): Promise<BridgeVirtualAccountView> {
    const owner = this.validateOwner(input.owner);
    const country = input.country.trim().toUpperCase();
    const sourceCurrency = input.sourceCurrency.toUpperCase();
    const destinationCurrency = input.destinationCurrency.toUpperCase();
    const network = input.network.trim().toUpperCase();
    const route = {
      ...this.ownerWhere(owner),
      provider: 'bridge',
      sourceCurrency,
      destinationCurrency,
      network,
    };
    const existing = await this.virtualAccountRepository.findOne({ where: route });
    if (existing) return this.toVirtualAccountView(existing);

    const capability = assertBridgePayrollCapability({
      operation: 'funding',
      sourceCurrency: sourceCurrency as 'USD' | 'EUR' | 'GBP' | 'NGN',
      currency: destinationCurrency as 'USDC' | 'USDT',
      country,
      network,
    });
    if (!capability.bridgeCurrency || !capability.bridgePaymentRail) {
      throw new ConflictException('Bridge deposit destination mapping is not configured.');
    }

    const onboarding = await this.refreshCustomerStatus(owner);
    const customer = await this.findCustomer(owner);
    if (onboarding.status !== 'approved' || !customer?.providerCustomerId) {
      throw new ConflictException(
        'Bridge identity verification and terms acceptance must be approved first.',
      );
    }

    await this.createWallet({
      owner,
      country,
      currency: destinationCurrency as 'USDC' | 'USDT',
      network,
    });
    const wallet = await this.walletRepository.findOne({
      where: { ...this.ownerWhere(owner), provider: 'bridge', network, status: 'active' },
      select: { id: true, providerWalletId: true, providerCustomerId: true, network: true },
    });
    if (!wallet || wallet.providerCustomerId !== customer.id) {
      throw new ConflictException('Bridge wallet is not available for this account.');
    }

    const remote = await this.bridgeApi.createVirtualAccount(
      customer.providerCustomerId,
      {
        source: { currency: sourceCurrency.toLowerCase() },
        destination: {
          currency: capability.bridgeCurrency,
          payment_rail: capability.bridgePaymentRail,
          bridge_wallet_id: wallet.providerWalletId,
        },
      },
      this.idempotencyKey(
        `virtual-account-${sourceCurrency}-${destinationCurrency}-${network}`,
        owner,
      ),
    );
    if (typeof remote.id !== 'string' || !remote.id || typeof remote.status !== 'string') {
      throw new PaymentProviderError(
        'Bridge returned an invalid virtual account response.',
        'INVALID_RESPONSE',
      );
    }
    const record = this.virtualAccountRepository.create({
      ...owner,
      providerCustomerId: customer.id,
      custodyWalletId: wallet.id,
      provider: 'bridge',
      providerVirtualAccountId: remote.id,
      sourceCurrency,
      destinationCurrency,
      network,
      status: this.readStatus(remote.status) ?? 'pending',
    });
    try {
      const saved = await this.virtualAccountRepository.save(record);
      return this.toVirtualAccountView(saved, remote, customer.providerCustomerId);
    } catch (error) {
      const concurrent = await this.virtualAccountRepository.findOne({ where: route });
      if (concurrent) return this.toVirtualAccountView(concurrent);
      throw error;
    }
  }

  async getVirtualAccounts(ownerInput: WalletOwnerScope): Promise<BridgeVirtualAccountView[]> {
    const owner = this.validateOwner(ownerInput);
    const accounts = await this.virtualAccountRepository.find({
      where: { ...this.ownerWhere(owner), provider: 'bridge' },
      select: {
        id: true,
        providerCustomerId: true,
        providerVirtualAccountId: true,
        sourceCurrency: true,
        destinationCurrency: true,
        network: true,
        status: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    if (!accounts.length) return [];
    const customers = await this.customerRepository.find({
      where: {
        id: In([...new Set(accounts.map((account) => account.providerCustomerId))]),
        ...this.ownerWhere(owner),
        provider: 'bridge',
      },
      select: { id: true, providerCustomerId: true },
    });
    const providerCustomerIds = new Map(
      customers
        .filter((customer) => customer.providerCustomerId)
        .map((customer) => [customer.id, customer.providerCustomerId as string]),
    );
    if (
      providerCustomerIds.size !==
      new Set(accounts.map((account) => account.providerCustomerId)).size
    ) {
      throw new ConflictException('Virtual account is not linked to this owner.');
    }
    const output: BridgeVirtualAccountView[] = [];
    for (let offset = 0; offset < accounts.length; offset += 4) {
      const batch = await Promise.all(
        accounts.slice(offset, offset + 4).map(async (account) => {
          const providerCustomerId = providerCustomerIds.get(account.providerCustomerId);
          if (!providerCustomerId) {
            throw new ConflictException('Virtual account is not linked to this owner.');
          }
          const remote = await this.bridgeApi.getVirtualAccount(
            providerCustomerId,
            account.providerVirtualAccountId,
          );
          return this.toVirtualAccountView(account, remote, providerCustomerId);
        }),
      );
      output.push(...batch);
    }
    return output;
  }

  private async findCustomer(owner: WalletOwnerScope): Promise<ProviderCustomer | null> {
    return this.customerRepository.findOne({
      where: { ...this.ownerWhere(owner), provider: 'bridge' },
      select: {
        id: true,
        providerCustomerId: true,
        providerKycLinkId: true,
        status: true,
        kycStatus: true,
        kybStatus: true,
        termsStatus: true,
      },
    });
  }

  private toWalletView(wallet: CustodyWallet): CustodyWalletView {
    return {
      id: wallet.id,
      network: wallet.network,
      address: wallet.address,
      status: wallet.status,
      createdAt: wallet.createdAt,
    };
  }

  private toExternalAccountView(account: ProviderExternalAccount) {
    return {
      id: account.id,
      currency: account.currency,
      sourceCurrency: account.sourceCurrency,
      network: account.network,
      status: account.status,
    };
  }

  private buildExternalAccountPayload(input: {
    method: PaymentMethod;
    firstName: string;
    lastName: string;
    address: {
      street_line_1: string;
      city: string;
      state?: string;
      postal_code?: string;
      country: string;
    };
  }): Record<string, unknown> {
    const { method, firstName, lastName, address } = input;
    const currency = method.currency?.toUpperCase();
    const accountNumber = method.accountNumber?.trim();
    const bankName = method.bankName?.trim();
    const accountOwnerName = method.accountName?.trim();
    if (!accountNumber || !bankName || !accountOwnerName) {
      throw new BadRequestException('Bank account details are incomplete.');
    }
    const base = {
      currency: currency?.toLowerCase(),
      bank_name: bankName,
      account_name: method.displayName?.trim() || bankName,
      first_name: firstName,
      last_name: lastName,
      account_owner_type: 'individual',
      account_owner_name: accountOwnerName,
      address,
    };
    if (currency === 'USD') {
      const routingNumber = method.bankCode?.replace(/\D/g, '');
      const usAccount = accountNumber.replace(/\D/g, '');
      if (!routingNumber || !/^\d{9}$/.test(routingNumber) || !/^\d{4,17}$/.test(usAccount)) {
        throw new BadRequestException(
          'USD Bridge account requires a valid routing and account number.',
        );
      }
      return {
        ...base,
        account_type: 'us',
        account: {
          routing_number: routingNumber,
          account_number: usAccount,
          checking_or_savings: 'checking',
        },
      };
    }
    if (currency === 'EUR') {
      const bic = method.bankCode?.replace(/\s/g, '').toUpperCase();
      const iban = accountNumber.replace(/\s/g, '').toUpperCase();
      if (
        !bic ||
        (bic.length !== 8 && bic.length !== 11) ||
        !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)
      ) {
        throw new BadRequestException('EUR Bridge account requires a valid IBAN and BIC.');
      }
      return {
        ...base,
        account_type: 'iban',
        iban: {
          account_number: iban,
          country: this.toIso3Country(method.country, method.country),
          bic,
        },
      };
    }
    if (currency === 'GBP') {
      const parsedIban = parseUkIban(accountNumber);
      const sortCode = (method.bankCode?.replace(/\D/g, '') || parsedIban?.sortCode || '').trim();
      const gbAccount = parsedIban?.accountNumber ?? accountNumber.replace(/\D/g, '');
      if (!/^\d{6}$/.test(sortCode) || !/^\d{6,8}$/.test(gbAccount)) {
        throw new BadRequestException(
          'GBP Bridge account requires a valid UK sort code and account number.',
        );
      }
      return {
        ...base,
        account_type: 'gb',
        account: { sort_code: sortCode, account_number: gbAccount },
      };
    }
    throw new BadRequestException('Bridge bank account currency is unsupported.');
  }

  private toIso3Country(
    country: string | null | undefined,
    fallback: string | null | undefined,
  ): string {
    const value = (country || fallback || '').trim().toUpperCase();
    const known: Record<string, string> = {
      US: 'USA',
      USA: 'USA',
      'UNITED STATES': 'USA',
      GB: 'GBR',
      UK: 'GBR',
      GBR: 'GBR',
      'UNITED KINGDOM': 'GBR',
      IE: 'IRL',
      IRL: 'IRL',
      IRELAND: 'IRL',
      NG: 'NGA',
      NGA: 'NGA',
      NIGERIA: 'NGA',
      DE: 'DEU',
      DEU: 'DEU',
      GERMANY: 'DEU',
      FR: 'FRA',
      FRA: 'FRA',
      FRANCE: 'FRA',
      NL: 'NLD',
      NLD: 'NLD',
      NETHERLANDS: 'NLD',
      ES: 'ESP',
      ESP: 'ESP',
      SPAIN: 'ESP',
      IT: 'ITA',
      ITA: 'ITA',
      ITALY: 'ITA',
      PT: 'PRT',
      PRT: 'PRT',
      PORTUGAL: 'PRT',
      BE: 'BEL',
      BEL: 'BEL',
      BELGIUM: 'BEL',
      AT: 'AUT',
      AUT: 'AUT',
      AUSTRIA: 'AUT',
      FI: 'FIN',
      FIN: 'FIN',
      FINLAND: 'FIN',
      GR: 'GRC',
      GRC: 'GRC',
      GREECE: 'GRC',
      LU: 'LUX',
      LUX: 'LUX',
      LUXEMBOURG: 'LUX',
    };
    const result = known[value] ?? (/^[A-Z]{3}$/.test(value) ? value : null);
    if (!result) {
      throw new BadRequestException(
        'Bridge requires a supported ISO country code for this bank account.',
      );
    }
    return result;
  }

  private async toVirtualAccountView(
    account: ProviderVirtualAccount,
    knownRemote?: Record<string, unknown>,
    knownProviderCustomerId?: string,
  ): Promise<BridgeVirtualAccountView> {
    let providerCustomerId = knownProviderCustomerId;
    if (!providerCustomerId) {
      const customer = await this.customerRepository.findOne({
        where: {
          id: account.providerCustomerId,
          ...this.ownerWhere({
            ownerType: account.ownerType,
            tenantId: account.tenantId,
            userId: account.userId,
          }),
          provider: 'bridge',
        },
        select: { providerCustomerId: true },
      });
      providerCustomerId = customer?.providerCustomerId ?? undefined;
    }
    if (!providerCustomerId) {
      throw new ConflictException('Virtual account is not linked to a completed Bridge customer.');
    }
    const remote =
      knownRemote ??
      (await this.bridgeApi.getVirtualAccount(
        providerCustomerId,
        account.providerVirtualAccountId,
      ));
    const instructions = remote.source_deposit_instructions;
    if (!instructions || typeof instructions !== 'object' || Array.isArray(instructions)) {
      throw new PaymentProviderError(
        'Bridge returned invalid virtual account instructions.',
        'INVALID_RESPONSE',
      );
    }
    return {
      id: account.id,
      sourceCurrency: account.sourceCurrency,
      destinationCurrency: account.destinationCurrency,
      network: account.network,
      status: this.readStatus(remote.status) ?? account.status,
      depositInstructions: instructions as Record<string, unknown>,
      createdAt: account.createdAt,
    };
  }

  private ownerWhere(owner: WalletOwnerScope) {
    return owner.ownerType === 'organization'
      ? { ownerType: 'organization' as const, tenantId: owner.tenantId!, userId: IsNull() }
      : { ownerType: 'employee' as const, tenantId: IsNull(), userId: owner.userId! };
  }

  private validateOwner(owner: WalletOwnerScope): WalletOwnerScope {
    const validOrganization =
      owner.ownerType === 'organization' && Boolean(owner.tenantId) && owner.userId === null;
    const validEmployee =
      owner.ownerType === 'employee' && Boolean(owner.userId) && owner.tenantId === null;
    if (!validOrganization && !validEmployee) {
      throw new BadRequestException(
        'Wallet owner must be one organization or one employee account.',
      );
    }
    return owner;
  }

  private idempotencyKey(operation: string, owner: WalletOwnerScope): string {
    const ownerId = owner.ownerType === 'organization' ? owner.tenantId : owner.userId;
    const digest = createHash('sha256')
      .update(`paqadhr:bridge:${operation}:${owner.ownerType}:${ownerId}`)
      .digest('hex');
    return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  }

  private readStatus(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const status = value.trim().toLowerCase();
    return /^[a-z_]{1,24}$/.test(status) ? status : null;
  }
}
