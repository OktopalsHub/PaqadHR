import { BadRequestException, Injectable } from '@nestjs/common';

interface FiatExchangeContext {
  countryCode?: string;
  operatorId?: number;
}

interface CachedRate {
  rate: number;
  expiresAt: number;
}

@Injectable()
export class FiatExchangeService {
  private readonly rateCache = new Map<string, CachedRate>();

  async convert(
    amount: number,
    from: string,
    to: string,
    ctx?: FiatExchangeContext,
  ): Promise<number> {
    const fromCur = from.toUpperCase();
    const toCur = to.toUpperCase();
    if (fromCur === toCur) {
      return amount;
    }

    const rate = await this.getExternalRate(fromCur, toCur);
    return Number((amount * rate).toFixed(2));
  }

  private getCacheTtlMs(): number {
    const raw = process.env.FX_CACHE_TTL_SECONDS;
    const seconds = raw ? Number(raw) : 3600;
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 3600_000;
  }

  private getCachedRate(fromCur: string, toCur: string): number | null {
    const key = `${fromCur}:${toCur}`;
    const cached = this.rateCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.rate;
    }
    return null;
  }

  private setCachedRate(fromCur: string, toCur: string, rate: number): void {
    this.rateCache.set(`${fromCur}:${toCur}`, {
      rate,
      expiresAt: Date.now() + this.getCacheTtlMs(),
    });
  }

  private async getExternalRate(fromCur: string, toCur: string): Promise<number> {
    const cached = this.getCachedRate(fromCur, toCur);
    if (cached != null) {
      return cached;
    }

    try {
      const rate = await this.fetchFrankfurterRate(fromCur, toCur);
      this.setCachedRate(fromCur, toCur, rate);
      return rate;
    } catch (error) {
      throw new BadRequestException(
        `Unable to convert ${fromCur} to ${toCur}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async fetchFrankfurterRate(fromCur: string, toCur: string): Promise<number> {
    const url = `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(fromCur)}/${encodeURIComponent(toCur)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!response.ok) {
      throw new Error(`Frankfurter API returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      base?: string;
      quote?: string;
      rate?: number;
    };
    if (!payload.rate || payload.rate <= 0) {
      throw new Error('Frankfurter API returned no valid rate');
    }
    return payload.rate;
  }
}
