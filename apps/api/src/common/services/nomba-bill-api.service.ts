import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  formatNombaSenderName,
  getNombaAccountId,
  getNombaBaseUrl,
  isNombaConfigured,
} from '../config/nomba.config';
import { isNombaAcceptedCode, isNombaOperationSuccessful } from '../config/nomba-api.util';
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

interface NombaBillResponse {
  code?: string;
  description?: string;
  data?: {
    id?: string;
    status?: string;
    amount?: number | string;
    token?: string;
    meta?: {
      merchantTxRef?: string;
      rrn?: string;
    };
  };
}

export interface NombaDataPlan {
  amount: number;
  plan: string;
}

interface NombaDataPlansResponse {
  code?: string;
  description?: string;
  data?: Array<{ amount?: number; plan?: string }> | { amount?: number; plan?: string };
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

@Injectable()
export class NombaBillApiService {
  private readonly logger = new Logger(NombaBillApiService.name);

  constructor(private readonly nombaTransferApi: NombaTransferApiService) {}

  isConfigured(): boolean {
    return isNombaConfigured();
  }

  private async request<T extends { code?: string; description?: string }>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
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

    let payload: T;
    try {
      payload = JSON.parse(responseText) as T;
    } catch {
      throw new BadRequestException('Nomba billing error: invalid JSON response');
    }

    // Nomba may return HTTP 200 with code "202" (accepted/processing) or "00" (success).
    if (!response.ok && !isNombaAcceptedCode(payload.code)) {
      const message = payload.description || `Nomba billing request failed (${response.status})`;
      this.logger.error(`Nomba billing request to ${path} failed: ${message}`);
      throw new BadRequestException(`Nomba billing error: ${message}`);
    }

    if (payload.code !== undefined && !isNombaAcceptedCode(payload.code)) {
      const message = payload.description || `Nomba billing error: code ${payload.code}`;
      this.logger.error(`Nomba billing request to ${path} failed: ${message}`);
      throw new BadRequestException(`Nomba billing error: ${message}`);
    }

    return payload;
  }

  private async getRequest<T extends { code?: string; description?: string }>(
    path: string,
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Nomba billing api is not configured');
    }

    const token = await this.nombaTransferApi.getAccessToken();

    const response = await fetch(`${getNombaBaseUrl()}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        accountId: getNombaAccountId(),
      },
    });

    const responseText = await response.text();

    let payload: T;
    try {
      payload = JSON.parse(responseText) as T;
    } catch {
      throw new BadRequestException('Nomba billing error: invalid JSON response');
    }

    if (!response.ok && !isNombaAcceptedCode(payload.code)) {
      const message = payload.description || `Nomba billing request failed (${response.status})`;
      this.logger.error(`Nomba billing GET ${path} failed: ${message}`);
      throw new BadRequestException(`Nomba billing error: ${message}`);
    }

    if (payload.code !== undefined && !isNombaAcceptedCode(payload.code)) {
      const message = payload.description || `Nomba billing error: code ${payload.code}`;
      this.logger.error(`Nomba billing GET ${path} failed: ${message}`);
      throw new BadRequestException(`Nomba billing error: ${message}`);
    }

    return payload;
  }

  async listDataPlans(telco: string): Promise<NombaDataPlan[]> {
    const normalized = telco.toUpperCase();
    const payload = await this.getRequest<NombaDataPlansResponse>(
      `/v1/bill/data-plan/${encodeURIComponent(normalized)}`,
    );

    const rows = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];

    return rows
      .filter((row) => row.amount != null && row.plan)
      .map((row) => ({
        amount: Number(row.amount),
        plan: String(row.plan),
      }));
  }

  async purchaseAirtime(input: NombaAirtimeInput): Promise<{
    success: boolean;
    transactionId: string | null;
    status: string;
  }> {
    const payload = await this.request<NombaBillResponse>('/v1/bill/topup', {
      amount: input.amount,
      phoneNumber: input.phoneNumber,
      network: input.network,
      merchantTxRef: input.merchantTxRef,
      senderName: input.senderName ?? formatNombaSenderName(),
    });

    const status = payload.data?.status ?? payload.description ?? 'UNKNOWN';
    const success = isNombaOperationSuccessful({ code: payload.code, status });

    return {
      success,
      transactionId:
        payload.data?.id ??
        payload.data?.meta?.rrn ??
        payload.data?.meta?.merchantTxRef ??
        input.merchantTxRef,
      status,
    };
  }

  async purchaseDataBundle(input: NombaAirtimeInput): Promise<{
    success: boolean;
    transactionId: string | null;
    status: string;
  }> {
    const payload = await this.request<NombaBillResponse>('/v1/bill/data', {
      amount: input.amount,
      phoneNumber: input.phoneNumber,
      network: input.network,
      merchantTxRef: input.merchantTxRef,
      senderName: input.senderName ?? formatNombaSenderName(),
    });

    const status = payload.data?.status ?? payload.description ?? 'UNKNOWN';
    const success = isNombaOperationSuccessful({ code: payload.code, status });

    return {
      success,
      transactionId:
        payload.data?.id ??
        payload.data?.meta?.rrn ??
        payload.data?.meta?.merchantTxRef ??
        input.merchantTxRef,
      status,
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
    const payload = await this.request<NombaBillResponse>('/v1/bill/electricity', {
      amount: input.amount,
      meterNumber: input.meterNumber,
      billerId: input.billerId,
      serviceType: input.serviceType,
      merchantTxRef: input.merchantTxRef,
    });

    const status = payload.data?.status ?? payload.description ?? 'UNKNOWN';
    const success = isNombaOperationSuccessful({ code: payload.code, status });

    return {
      success,
      transactionId:
        payload.data?.id ??
        payload.data?.meta?.rrn ??
        payload.data?.meta?.merchantTxRef ??
        input.merchantTxRef,
      status,
      token: payload.data?.token ?? null,
    };
  }
}
