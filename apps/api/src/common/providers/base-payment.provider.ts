import { User } from '../../modules/v1/users/entities/user.entity';
import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  PaymentProviderError
} from './payment-provider.interface';
import { PaymentProviderInterface } from "../interfaces/payment-provider-interface.interface";
import { CreatePaymentData } from "../interfaces/create-payment-data.interface";
import { WebhookResult } from "../interfaces/webhook-result.interface";
import { CurrencyConfig } from "../interfaces/currency-config.interface";
import { TransactionStatus } from "../enums/transaction-status.enum";
import { PaymentResult } from "../interfaces/payment-result.interface";

export abstract class BasePaymentProvider implements PaymentProviderInterface {
  protected readonly logger: Logger;
  protected readonly baseUrl: string;
  protected readonly isTestMode: boolean;
  protected currencyConfigs: Map<string, CurrencyConfig> = new Map();
  protected rateLimiter: Map<string, number[]> = new Map();
  constructor(
    protected readonly name: string,
    baseUrl?: string,
    testMode = false,
  ) {
    this.logger = new Logger(`${name}PaymentProvider`);
    this.baseUrl = baseUrl || this.getDefaultBaseUrl();
    this.isTestMode = testMode;
    this.initializeCurrencyConfigs();
  }
  abstract createPayment(data: CreatePaymentData): Promise<PaymentResult>;
  abstract processWebhook(
    payload: unknown,
    signature: string,
  ): Promise<WebhookResult>;
  abstract getSupportedCurrencies(): Promise<string[]>;
  abstract validateSignature(payload: unknown, signature: string): boolean;
  abstract getTransactionStatus(
    transactionId: string,
  ): Promise<TransactionStatus>;
  protected abstract getDefaultBaseUrl(): string;
  protected abstract initializeCurrencyConfigs(): void;
  async validateCurrency(currency: string): Promise<boolean> {
    try {
      const supportedCurrencies = await this.getSupportedCurrencies();
      return supportedCurrencies.includes(currency.toUpperCase());
    } catch (error) {
      this.logger.error(`Error validating currency ${currency}:`, error);
      return false;
    }
  }
  formatAmount(amount: number, currency: string): number {
    const config = this.currencyConfigs.get(currency.toUpperCase());
    if (!config) {
      this.logger.warn(
        `No config found for currency ${currency}, using default 2 decimals`,
      );
      return Math.round(amount * 100);
    }
    const multiplier = Math.pow(10, config.decimals);
    return Math.round(amount * multiplier);
  }
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', '/health', null, 5000);
      return response.ok;
    } catch (error) {
      this.logger.warn(`Health check failed for ${this.name}:`, error);
      return false;
    }
  }
  protected async makeRequest(
    method: string,
    endpoint: string,
    data?: unknown,
    timeout = 30000,
    retries = 3,
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.checkRateLimit();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, {
          method,
          headers: await this.getHeaders(),
          body: data ? JSON.stringify(data) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (response.ok || attempt === retries) {
          return response;
        }
        await this.delay(Math.pow(2, attempt) * 1000);
      } catch (error) {
        if (attempt === retries) {
          throw new PaymentProviderError(
            `Request failed after ${retries} attempts: ${error.message}`,
            'REQUEST_FAILED',
            true,
            error,
          );
        }
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    throw new PaymentProviderError(
      `Request failed after ${retries} attempts`,
      'REQUEST_FAILED',
      true,
    );
  }
  protected async getHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': `PAQADHR-PaymentProvider/${this.name}`,
    };
  }
  protected async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const windowMs = 60000; 
    const maxRequests = 100; 
    const requests = this.rateLimiter.get(this.name) || [];
    const recentRequests = requests.filter((time) => now - time < windowMs);
    if (recentRequests.length >= maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const waitTime = windowMs - (now - oldestRequest);
      await this.delay(waitTime);
    }
    recentRequests.push(now);
    this.rateLimiter.set(this.name, recentRequests);
  }
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  protected generateReference(prefix = 'PAY'): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }
  protected validateAmount(amount: number, currency: string): void {
    const config = this.currencyConfigs.get(currency.toUpperCase());
    if (amount <= 0) {
      throw new PaymentProviderError(
        'Amount must be greater than zero',
        'INVALID_AMOUNT',
        false,
      );
    }
    if (config?.minAmount && amount < config.minAmount) {
      throw new PaymentProviderError(
        `Amount ${amount} is below minimum ${config.minAmount} for ${currency}`,
        'AMOUNT_TOO_LOW',
        false,
      );
    }
    if (config?.maxAmount && amount > config.maxAmount) {
      throw new PaymentProviderError(
        `Amount ${amount} exceeds maximum ${config.maxAmount} for ${currency}`,
        'AMOUNT_TOO_HIGH',
        false,
      );
    }
  }
  protected validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  protected sanitizeMetadata(
    metadata: Record<string, any>,
  ): Record<string, any> {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (this.isSensitiveKey(key)) {
        continue;
      }
      if (typeof value === 'string' && value.length > 255) {
        sanitized[key] = value.substring(0, 255);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password',
      'secret',
      'token',
      'key',
      'pin',
      'ssn',
      'social_security',
      'credit_card',
      'cvv',
      'cvc',
    ];
    return sensitiveKeys.some((sensitive) =>
      key.toLowerCase().includes(sensitive),
    );
  }
  protected createSecureHash(
    data: string,
    secret: string,
    algorithm = 'sha256',
  ): string {
    return crypto.createHmac(algorithm, secret).update(data).digest('hex');
  }
  protected verifySecureHash(
    data: string,
    signature: string,
    secret: string,
    algorithm = 'sha256',
  ): boolean {
    try {
      const expectedSignature = this.createSecureHash(data, secret, algorithm);
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch (error) {
      this.logger.error('Error verifying hash:', error);
      return false;
    }
  }
  protected logTransaction(
    action: string,
    transactionId: string,
    amount?: number,
    currency?: string,
    status?: string,
    error?: unknown,
  ): void {
    const logData = {
      provider: this.name,
      action,
      transactionId,
      amount,
      currency,
      status,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : undefined,
    };
    if (error) {
      this.logger.error(`Transaction ${action} failed:`, logData);
    } else {
      this.logger.log(`Transaction ${action}:`, logData);
    }
  }
}
