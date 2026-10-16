import { Injectable, Logger } from '@nestjs/common';
import {
  CLOUDFLARE_API_BASE_URL,
  resolveWorkerDomainConfig,
  type WorkerDomainConfig,
} from '../config/worker-domain.config';

const REQUEST_TIMEOUT_MS = 5_000;
const PAGE_SIZE = 50;
const MAX_PAGES = 20;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `disabled` and `failed` are non-fatal: workspace creation must not depend on Cloudflare. */
export type WorkerDomainOutcome =
  | 'created'
  | 'present'
  | 'deleted'
  | 'absent'
  | 'disabled'
  | 'failed';

interface WorkerDomain {
  id: string;
  hostname: string;
}

interface CloudflareEnvelope<T> {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: T;
  result_info?: { page?: number; total_pages?: number };
}

/**
 * Attaches tenant subdomains (`acme.paqadhr.com`) to the web Worker as Cloudflare
 * custom domains. A `*.paqadhr.com` Worker route cannot be used because it would also
 * swallow the API hostnames, so each tenant gets its own custom domain — Cloudflare then
 * creates the DNS record and certificate for it.
 */
@Injectable()
export class WorkerDomainService {
  private readonly logger = new Logger(WorkerDomainService.name);
  private readonly config: WorkerDomainConfig = resolveWorkerDomainConfig();
  private warnedDisabled = false;

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** `acme` -> `acme.paqadhr.com`; null when the slug can never be a hostname. */
  hostnameFor(slug: string): string | null {
    const normalized = slug?.trim().toLowerCase();
    if (!normalized || !SLUG_PATTERN.test(normalized)) {
      return null;
    }
    return `${normalized}.${this.config.hostSuffix}`;
  }

  /** Idempotent: returns `present` when the hostname is already attached. */
  async ensure(slug: string): Promise<WorkerDomainOutcome> {
    if (!this.config.enabled) {
      this.warnDisabled();
      return 'disabled';
    }
    const hostname = this.hostnameFor(slug);
    if (!hostname) {
      this.logger.warn(`Cannot provision a subdomain for invalid tenant slug "${slug}"`);
      return 'failed';
    }

    const domains = await this.listDomains();
    if (!domains) {
      return 'failed';
    }
    if (domains.some((domain) => domain.hostname === hostname)) {
      return 'present';
    }

    const created = await this.request<WorkerDomain>('PUT', '/workers/domains', {
      zone_id: this.config.zoneId,
      hostname,
      service: this.config.workerName,
      environment: 'production',
    });
    if (!created) {
      return 'failed';
    }

    this.logger.log(`Attached ${hostname} to Worker ${this.config.workerName}`);
    return 'created';
  }

  /** Detaches the tenant subdomain; safe to call when it was never attached. */
  async remove(slug: string): Promise<WorkerDomainOutcome> {
    if (!this.config.enabled) {
      this.warnDisabled();
      return 'disabled';
    }
    const hostname = this.hostnameFor(slug);
    if (!hostname) {
      return 'failed';
    }

    const domains = await this.listDomains();
    if (!domains) {
      return 'failed';
    }
    const match = domains.find((domain) => domain.hostname === hostname);
    if (!match) {
      return 'absent';
    }

    const removed = await this.request<unknown>('DELETE', `/workers/domains/${match.id}`);
    if (!removed) {
      return 'failed';
    }

    this.logger.log(`Detached ${hostname} from Worker ${this.config.workerName}`);
    return 'deleted';
  }

  /** Hostnames currently attached to the configured Worker, or null when unreachable. */
  async listHostnames(): Promise<string[] | null> {
    if (!this.config.enabled) {
      this.warnDisabled();
      return null;
    }
    const domains = await this.listDomains();
    return domains ? domains.map((domain) => domain.hostname) : null;
  }

  private async listDomains(): Promise<WorkerDomain[] | null> {
    const domains: WorkerDomain[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const response = await this.request<WorkerDomain[]>(
        'GET',
        `/workers/domains?zone_id=${encodeURIComponent(this.config.zoneId)}&page=${page}&per_page=${PAGE_SIZE}`,
      );
      if (!response) {
        return null;
      }
      const items = Array.isArray(response.result) ? response.result : [];
      domains.push(...items.filter((item) => typeof item?.hostname === 'string'));
      const totalPages = response.result_info?.total_pages ?? 1;
      if (page >= totalPages || items.length === 0) {
        break;
      }
    }
    return domains;
  }

  private async request<T>(
    method: 'GET' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<CloudflareEnvelope<T> | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${CLOUDFLARE_API_BASE_URL}/accounts/${this.config.accountId}${path}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        },
      );
      const payload = (await response.json().catch(() => null)) as CloudflareEnvelope<T> | null;
      if (!response.ok || payload?.success === false) {
        this.logger.error(
          `Cloudflare ${method} ${path} failed (HTTP ${response.status}): ${this.describeErrors(payload)}`,
        );
        return null;
      }
      return payload ?? { success: true };
    } catch (error) {
      this.logger.error(`Cloudflare ${method} ${path} request failed: ${(error as Error).message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private describeErrors(payload: CloudflareEnvelope<unknown> | null): string {
    const errors = payload?.errors;
    if (!errors?.length) {
      return 'no error detail';
    }
    return errors.map((error) => `${error.code ?? '?'} ${error.message ?? ''}`.trim()).join('; ');
  }

  private warnDisabled(): void {
    if (this.warnedDisabled) {
      return;
    }
    this.warnedDisabled = true;
    this.logger.warn(
      'Tenant subdomains are not provisioned: set CF_WORKER_DOMAIN_API_TOKEN, CF_WORKER_DOMAIN_ZONE_ID and CF_WORKER_DOMAIN_WORKER_NAME to enable (see .env.example)',
    );
  }
}
