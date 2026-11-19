import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

import { isBridgeConfigured } from './bridge.config';

export const PAYROLL_ASSETS = ['USD', 'EUR', 'GBP', 'NGN', 'USDT', 'USDC'] as const;
export type PayrollAsset = (typeof PAYROLL_ASSETS)[number];
export const BRIDGE_PAYROLL_OPERATIONS = [
  'wallet_creation',
  'funding',
  'payout',
  'wallet_transfer',
  'withdrawal',
  'conversion',
] as const;
export type BridgePayrollOperation = (typeof BRIDGE_PAYROLL_OPERATIONS)[number];

export interface BridgePayrollCapability {
  operation: BridgePayrollOperation;
  sourceCurrency: PayrollAsset;
  currency: PayrollAsset;
  country: string;
  network: string | null;
  bridgeChain?: string;
  bridgeCurrency?: string;
  bridgePaymentRail?: string;
}

/** Account-specific capabilities; unset means no payroll route is enabled. */
export function getBridgePayrollCapabilities(): readonly BridgePayrollCapability[] {
  const raw = process.env.BRIDGE_PAYROLL_CAPABILITIES?.trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ServiceUnavailableException('Bridge payroll capability configuration is invalid.');
  }
  if (!Array.isArray(parsed)) {
    throw new ServiceUnavailableException(
      'Bridge payroll capability configuration must be an array.',
    );
  }

  const capabilities: BridgePayrollCapability[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ServiceUnavailableException('Bridge payroll capability entry is invalid.');
    }
    const value = entry as Record<string, unknown>;
    const allowedFields = new Set([
      'operation',
      'sourceCurrency',
      'currency',
      'country',
      'network',
      'bridgeChain',
      'bridgeCurrency',
      'bridgePaymentRail',
    ]);
    if (Object.keys(value).some((key) => !allowedFields.has(key))) {
      throw new ServiceUnavailableException(
        'Bridge payroll capability entry contains an unknown field.',
      );
    }
    const operation = value.operation;
    const sourceCurrency = value.sourceCurrency;
    const currency = value.currency;
    const country = value.country;
    const network = value.network;
    const bridgeChain = value.bridgeChain;
    const bridgeCurrency = value.bridgeCurrency;
    const bridgePaymentRail = value.bridgePaymentRail;
    if (
      typeof operation !== 'string' ||
      !BRIDGE_PAYROLL_OPERATIONS.includes(operation as BridgePayrollOperation) ||
      typeof sourceCurrency !== 'string' ||
      !PAYROLL_ASSETS.includes(sourceCurrency as PayrollAsset) ||
      typeof currency !== 'string' ||
      !PAYROLL_ASSETS.includes(currency as PayrollAsset) ||
      typeof country !== 'string' ||
      !/^[A-Z]{2}$/.test(country) ||
      (network !== null && (typeof network !== 'string' || !/^[A-Z0-9_-]{2,32}$/.test(network)))
    ) {
      throw new ServiceUnavailableException('Bridge payroll capability entry is invalid.');
    }
    const tokenInvolved = isTokenCurrency(sourceCurrency) || isTokenCurrency(currency);
    if ((tokenInvolved && typeof network !== 'string') || (!tokenInvolved && network !== null)) {
      throw new ServiceUnavailableException(
        'Bridge payroll capability asset/network combination is invalid.',
      );
    }
    if (
      (operation === 'wallet_creation' &&
        (typeof bridgeChain !== 'string' || !/^[a-z][a-z0-9_-]{1,31}$/.test(bridgeChain))) ||
      (operation !== 'wallet_creation' && bridgeChain !== undefined)
    ) {
      throw new ServiceUnavailableException('Bridge wallet chain configuration is invalid.');
    }
    if (
      (['funding', 'wallet_transfer', 'withdrawal'].includes(operation as string) &&
        (typeof bridgeCurrency !== 'string' ||
          !/^[a-z][a-z0-9_-]{1,31}$/.test(bridgeCurrency) ||
          typeof bridgePaymentRail !== 'string' ||
          !/^[a-z][a-z0-9_-]{1,31}$/.test(bridgePaymentRail))) ||
      (!['funding', 'wallet_transfer', 'withdrawal'].includes(operation as string) &&
        (bridgeCurrency !== undefined || bridgePaymentRail !== undefined))
    ) {
      throw new ServiceUnavailableException('Bridge provider route mapping is invalid.');
    }
    capabilities.push({
      operation: operation as BridgePayrollOperation,
      sourceCurrency: sourceCurrency as PayrollAsset,
      currency: currency as PayrollAsset,
      country,
      network: network as string | null,
      ...(typeof bridgeChain === 'string' ? { bridgeChain } : {}),
      ...(typeof bridgeCurrency === 'string' ? { bridgeCurrency } : {}),
      ...(typeof bridgePaymentRail === 'string' ? { bridgePaymentRail } : {}),
    });
  }
  return capabilities;
}

export function isBridgePayrollEnabled(): boolean {
  return (
    isBridgeConfigured() &&
    getBridgePayrollCapabilities().some((capability) => capability.operation === 'wallet_transfer')
  );
}

export function assertBridgePayrollCapability(
  requested: BridgePayrollCapability,
): BridgePayrollCapability {
  const normalized: BridgePayrollCapability = {
    ...requested,
    sourceCurrency: requested.sourceCurrency.toUpperCase() as PayrollAsset,
    currency: requested.currency.toUpperCase() as PayrollAsset,
    country: requested.country.toUpperCase(),
    network: requested.network?.toUpperCase() ?? null,
  };
  if (
    !PAYROLL_ASSETS.includes(normalized.currency) ||
    !PAYROLL_ASSETS.includes(normalized.sourceCurrency)
  ) {
    throw new BadRequestException(
      `Payroll does not support ${requested.sourceCurrency}/${requested.currency}.`,
    );
  }
  if (!/^[A-Z]{2}$/.test(normalized.country)) {
    throw new BadRequestException('Payroll route country must be an ISO alpha-2 code.');
  }
  const tokenInvolved =
    isTokenCurrency(normalized.sourceCurrency) || isTokenCurrency(normalized.currency);
  if (
    (tokenInvolved && (!normalized.network || !/^[A-Z0-9_-]{2,32}$/.test(normalized.network))) ||
    (!tokenInvolved && normalized.network !== null)
  ) {
    throw new BadRequestException(
      'Payroll route network does not match its source and destination assets.',
    );
  }
  const match = getBridgePayrollCapabilities().find(
    (capability) =>
      capability.operation === normalized.operation &&
      capability.sourceCurrency === normalized.sourceCurrency &&
      capability.currency === normalized.currency &&
      capability.country === normalized.country &&
      capability.network === normalized.network,
  );
  if (!match) {
    throw new ServiceUnavailableException(
      `Bridge payroll ${requested.operation} is not enabled for ${requested.currency} in ${requested.country}${requested.network ? ` on ${requested.network}` : ''}.`,
    );
  }
  return {
    ...normalized,
    ...(match.bridgeChain ? { bridgeChain: match.bridgeChain } : {}),
    ...(match.bridgeCurrency ? { bridgeCurrency: match.bridgeCurrency } : {}),
    ...(match.bridgePaymentRail ? { bridgePaymentRail: match.bridgePaymentRail } : {}),
  };
}

function isTokenCurrency(currency: string): boolean {
  return currency === 'USDT' || currency === 'USDC';
}
