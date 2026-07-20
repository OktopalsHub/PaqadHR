import { Injectable, Logger } from '@nestjs/common';
import { defaultPayrollCurrency } from 'src/common/config/nomba.config';
import { normalizeFiatCurrencies } from 'src/common/constants/supported-fiat-currencies.constant';
import {
  getSupportedPaymentCurrencies,
  NOMBA_FIAT_CURRENCIES,
  NOAH_FIAT_CURRENCIES,
} from 'src/common/constants/supported-payment-currencies.constant';
import type { PointsSettings } from 'src/common/interfaces/points-settings.interface';
import type { ShoutoutSettings } from 'src/common/interfaces/shoutout-settings.interface';
import { PAGINATION_DEFAULT_LIMIT } from 'src/common/utils/pagination.util';
import { TenantSettingRepository } from './tenant-setting.repository';

@Injectable()
export class TenantConfigService {
  private readonly logger = new Logger(TenantConfigService.name);

  constructor(private readonly tenantSettingsRepository: TenantSettingRepository) {}

  private async getSettingsRecord(tenantId: string) {
    return this.tenantSettingsRepository.findOne({ where: { tenantId } });
  }

  async getEmployeeNumberPrefix(tenantId: string): Promise<string> {
    const settings = await this.getSettingsRecord(tenantId);
    return settings?.settings.employee?.numberPrefix || '';
  }

  async getEmployeeNumberPadding(tenantId: string): Promise<number> {
    try {
      const settings = await this.getSettingsRecord(tenantId);
      return settings?.settings.employee?.numberPadding || 3;
    } catch (error) {
      this.logger.warn(
        `Failed to get employee padding for tenant ${tenantId}, using default: ${error instanceof Error ? error.message : error}`,
      );
      return 3;
    }
  }

  async getPointsSettings(tenantId: string): Promise<PointsSettings | null> {
    const settings = await this.getSettingsRecord(tenantId);
    return settings?.settings.points ?? null;
  }

  async getShoutoutSettings(tenantId: string): Promise<ShoutoutSettings | null> {
    const settings = await this.getSettingsRecord(tenantId);
    return settings?.settings.shoutouts ?? null;
  }

  async getPointsStartingBalance(tenantId: string): Promise<number> {
    try {
      const settings = await this.getSettingsRecord(tenantId);
      return settings?.settings.points?.startingBalance || 100;
    } catch (error) {
      this.logger.warn(
        `Failed to get points starting balance for tenant ${tenantId}, using default: ${error instanceof Error ? error.message : error}`,
      );
      return 100;
    }
  }

  async getPointsDailyLimit(tenantId: string): Promise<number> {
    try {
      const settings = await this.getSettingsRecord(tenantId);
      return settings?.settings.points?.dailyLimit || 50;
    } catch (error) {
      this.logger.warn(
        `Failed to get daily points limit for tenant ${tenantId}, using default: ${error instanceof Error ? error.message : error}`,
      );
      return 50;
    }
  }

  async getPointsMonthlyLimit(tenantId: string): Promise<number> {
    try {
      const settings = await this.getSettingsRecord(tenantId);
      return settings?.settings.points?.monthlyLimit || 1000;
    } catch (error) {
      this.logger.warn(
        `Failed to get monthly points limit for tenant ${tenantId}, using default: ${error instanceof Error ? error.message : error}`,
      );
      return 1000;
    }
  }

  async getPaginationLimit(tenantId: string): Promise<number> {
    try {
      const settings = await this.getSettingsRecord(tenantId);
      return settings?.settings.general?.paginationLimit ?? PAGINATION_DEFAULT_LIMIT;
    } catch (error) {
      this.logger.warn(
        `Failed to get pagination limit for tenant ${tenantId}, using default: ${error instanceof Error ? error.message : error}`,
      );
      return PAGINATION_DEFAULT_LIMIT;
    }
  }

  async getPayrollCurrencies(
    tenantId: string,
    preferredCurrency?: string | null,
  ): Promise<string[]> {
    const allowed = new Set(getSupportedPaymentCurrencies());
    const settings = await this.getSettingsRecord(tenantId);
    const configured = settings?.settings.general?.payrollCurrencies;
    if (Array.isArray(configured) && configured.length > 0) {
      const normalized = normalizeFiatCurrencies(configured).filter((code) => allowed.has(code));
      if (normalized.length > 0) {
        return normalized;
      }
    }

    const primary = (
      settings?.settings.general?.currency ??
      preferredCurrency ??
      defaultPayrollCurrency()
    ).toUpperCase();
    const fallback = normalizeFiatCurrencies([primary]).filter((code) => allowed.has(code));
    return fallback.length > 0 ? fallback : ['NGN'];
  }

  getGloballySupportedFiatCurrencies(): readonly string[] {
    return [...NOMBA_FIAT_CURRENCIES, ...NOAH_FIAT_CURRENCIES];
  }

  async getTenantConfig(tenantId: string): Promise<{
    employee: {
      numberPrefix: string;
      numberPadding: number;
    };
    points: {
      startingBalance: number;
      dailyLimit: number;
      monthlyLimit: number;
    };
    general: {
      paginationLimit: number;
    };
  }> {
    try {
      const settings = await this.getSettingsRecord(tenantId);
      if (!settings) {
        throw new Error('Settings not found');
      }
      return {
        employee: {
          numberPrefix: settings.settings.employee?.numberPrefix || '',
          numberPadding: settings.settings.employee?.numberPadding || 3,
        },
        points: {
          startingBalance: settings.settings.points?.startingBalance || 100,
          dailyLimit: settings.settings.points?.dailyLimit || 50,
          monthlyLimit: settings.settings.points?.monthlyLimit || 1000,
        },
        general: {
          paginationLimit: settings.settings.general?.paginationLimit ?? PAGINATION_DEFAULT_LIMIT,
        },
      };
    } catch (error) {
      this.logger.warn(
        `Failed to get tenant config for tenant ${tenantId}, using defaults: ${error instanceof Error ? error.message : error}`,
      );
      return {
        employee: {
          numberPrefix: 'EMP',
          numberPadding: 3,
        },
        points: {
          startingBalance: 100,
          dailyLimit: 50,
          monthlyLimit: 1000,
        },
        general: {
          paginationLimit: PAGINATION_DEFAULT_LIMIT,
        },
      };
    }
  }

  async generateEmployeeNumber(tenantId: string, employeeCount: number): Promise<string> {
    const prefix = await this.getEmployeeNumberPrefix(tenantId);
    const padding = await this.getEmployeeNumberPadding(tenantId);
    const paddedNumber = (employeeCount + 1).toString().padStart(padding, '0');
    return `${prefix}${paddedNumber}`;
  }

  async validatePointsOperation(
    tenantId: string,
    currentDailyPoints: number,
    currentMonthlyPoints: number,
    pointsToAdd: number,
  ): Promise<{
    isValid: boolean;
    reason?: string;
    limits: {
      dailyLimit: number;
      monthlyLimit: number;
      dailyRemaining: number;
      monthlyRemaining: number;
    };
  }> {
    const dailyLimit = await this.getPointsDailyLimit(tenantId);
    const monthlyLimit = await this.getPointsMonthlyLimit(tenantId);
    const dailyRemaining = Math.max(0, dailyLimit - currentDailyPoints);
    const monthlyRemaining = Math.max(0, monthlyLimit - currentMonthlyPoints);
    const wouldExceedDaily = currentDailyPoints + pointsToAdd > dailyLimit;
    const wouldExceedMonthly = currentMonthlyPoints + pointsToAdd > monthlyLimit;
    let isValid = true;
    let reason: string | undefined;
    if (wouldExceedDaily) {
      isValid = false;
      reason = `Would exceed daily limit of ${dailyLimit} Paq points. ${dailyRemaining} Paq points remaining today.`;
    } else if (wouldExceedMonthly) {
      isValid = false;
      reason = `Would exceed monthly limit of ${monthlyLimit} Paq points. ${monthlyRemaining} Paq points remaining this month.`;
    }
    return {
      isValid,
      reason,
      limits: {
        dailyLimit,
        monthlyLimit,
        dailyRemaining,
        monthlyRemaining,
      },
    };
  }
}
