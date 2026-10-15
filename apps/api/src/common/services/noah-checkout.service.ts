import { BadRequestException, Injectable } from '@nestjs/common';
import { isCryptoCurrency } from '../constants/crypto-currencies.constant';
import { NoahAuthService } from './noah-auth.service';

function stringifyMeta(
  meta?: Record<string, string | number | boolean | undefined>,
): Record<string, string> {
  if (!meta) return {};
  return Object.fromEntries(
    Object.entries(meta)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

export interface NoahCheckoutInput {
  orderReference: string;
  customerEmail: string;
  amount: number;
  currency: string;
  callbackUrl: string;
  customerId?: string;
  tokenizeCard?: boolean;
  meta?: Record<string, string | number | boolean | undefined>;
}

export interface NoahTokenizedChargeInput {
  orderReference: string;
  customerEmail: string;
  amount: number;
  currency: string;
  callbackUrl: string;
  paymentMethodId: string;
  meta?: Record<string, string | number | boolean | undefined>;
}

@Injectable()
export class NoahCheckoutService {
  constructor(private readonly auth: NoahAuthService) {}

  async createPayinCheckout(input: NoahCheckoutInput): Promise<{
    checkoutLink: string;
    orderReference: string;
  }> {
    const currency = input.currency.toUpperCase();
    const isCrypto = isCryptoCurrency(currency);
    const path = isCrypto ? '/checkout/payin/crypto' : '/checkout/payin/fiat';

    const payload = await this.auth.request<{
      checkoutUrl?: string;
      checkoutLink?: string;
      url?: string;
      orderReference?: string;
      reference?: string;
      id?: string;
    }>(
      'POST',
      path,
      {
        customerID: input.customerId ?? input.customerEmail,
        customerEmail: input.customerEmail,
        fiatAmount: String(input.amount),
        fiatCurrency: currency,
        cryptoCurrency: isCrypto ? currency : undefined,
        returnURL: input.callbackUrl,
        externalID: input.orderReference,
        metadata: stringifyMeta(input.meta),
        savePaymentMethod: input.tokenizeCard ?? true,
      },
      undefined,
      input.orderReference,
    );

    const checkoutLink = payload.checkoutUrl ?? payload.checkoutLink ?? payload.url;
    if (!checkoutLink) {
      throw new BadRequestException('Failed to initialize Noah checkout');
    }

    return {
      checkoutLink,
      orderReference: payload.orderReference ?? payload.reference ?? input.orderReference,
    };
  }

  async chargeSavedPaymentMethod(input: NoahTokenizedChargeInput): Promise<{
    orderReference: string;
  }> {
    const payload = await this.auth.request<{
      orderReference?: string;
      reference?: string;
      externalID?: string;
      id?: string;
    }>(
      'POST',
      '/checkout/payin/fiat',
      {
        customerEmail: input.customerEmail,
        fiatAmount: String(input.amount),
        fiatCurrency: input.currency.toUpperCase(),
        returnURL: input.callbackUrl,
        externalID: input.orderReference,
        paymentMethodID: input.paymentMethodId,
        metadata: stringifyMeta(input.meta),
      },
      undefined,
      input.orderReference,
    );

    return {
      orderReference:
        payload.orderReference ?? payload.reference ?? payload.externalID ?? input.orderReference,
    };
  }
}
