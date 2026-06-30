import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { getNombaAccountId, getNombaBaseUrl, isNombaConfigured } from '../config/nomba.config';
import { NombaTransferApiService } from './nomba-transfer-api.service';

export interface NombaAirtimeInput {
  amount: number;
  phoneNumber: string;
  network: 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';
  merchantTxRef: string;
  senderName?: string;
}

export interface NombaElectricityInput {
  amount: number;
  meterNumber: string;
  billerId: string;
  serviceType: 'PREPAID' | 'POSTPAID';
  merchantTxRef: string;
}

interface NombaTopupResponse {
  code?: string;
  description?: string;
  data?: {
    id?: string;
    status?: string;
    amount?: number;
  };
}

interface NombaElectricityLookupResponse {
  code?: string;
  description?: string;
  data?: {
    customerName?: string;
    meterNumber?: string;
    address?: string;
    billerId?: string;
  };
}

interface NombaElectricityPayResponse {
  code?: string;
  description?: string;
  data?: {
    id?: string;
    status?: string;
    token?: string;
    amount?: number;
  };
}

@Injectable()
export class NombaBillApiService {
  private readonly logger = new Logger(NombaBillApiService.name);

  constructor(private readonly nombaTransferApi: NombaTransferApiService) {}

  isConfigured(): boolean {
    return isNombaConfigured();
  }

  private async request<T>(path: string, body: Record<string, any>): Promise<T> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Nomba billing api is not configured');
    }

    const token = await this.nombaTransferApi.getAccessToken();

    const response = await fetch(`${getNombaBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        accountId: getNombaAccountId(),
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      let message = `Nomba billing request failed (${response.status})`;
      try {
        const errorPayload = JSON.parse(responseText) as { message?: string; description?: string };
        if (errorPayload?.message || errorPayload?.description) {
          message = errorPayload.message || errorPayload.description || message;
        }
      } catch {}
      this.logger.error(`Nomba billing request to ${path} failed: ${message}`);
      throw new BadRequestException(`Nomba billing error: ${message}`);
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new BadRequestException('Nomba billing error: invalid JSON response');
    }
  }

  async purchaseAirtime(input: NombaAirtimeInput): Promise<{
    success: boolean;
    transactionId: string | null;
    status: string;
  }> {
    const payload = await this.request<NombaTopupResponse>('/v1/bill/topup', {
      amount: input.amount,
      phoneNumber: input.phoneNumber,
      network: input.network,
      merchantTxRef: input.merchantTxRef,
      senderName: input.senderName ?? 'PAQAD HR',
    });

    return {
      success: payload.code === '00',
      transactionId: payload.data?.id ?? null,
      status: payload.data?.status ?? 'UNKNOWN',
    };
  }

  async lookupElectricity(
    billerId: string,
    meterNumber: string,
    serviceType: string,
  ): Promise<{
    customerName: string | null;
    meterNumber: string | null;
    address: string | null;
    billerId: string | null;
  }> {
    const payload = await this.request<NombaElectricityLookupResponse>(
      '/v1/bill/electricity/lookup',
      {
        billerId,
        meterNumber,
        serviceType,
      },
    );

    return {
      customerName: payload.data?.customerName ?? null,
      meterNumber: payload.data?.meterNumber ?? null,
      address: payload.data?.address ?? null,
      billerId: payload.data?.billerId ?? null,
    };
  }

  async purchaseElectricity(input: NombaElectricityInput): Promise<{
    success: boolean;
    transactionId: string | null;
    status: string;
    token: string | null;
  }> {
    const payload = await this.request<NombaElectricityPayResponse>('/v1/bill/electricity', {
      amount: input.amount,
      meterNumber: input.meterNumber,
      billerId: input.billerId,
      serviceType: input.serviceType,
      merchantTxRef: input.merchantTxRef,
    });

    return {
      success: payload.code === '00',
      transactionId: payload.data?.id ?? null,
      status: payload.data?.status ?? 'UNKNOWN',
      token: payload.data?.token ?? null,
    };
  }
}
