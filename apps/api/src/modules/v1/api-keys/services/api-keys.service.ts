import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  API_KEY_SCOPES,
  type ApiKeyScope,
  HIGH_RISK_API_KEY_SCOPES,
  isApiKeyScope,
} from '@paqadhr/contracts';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity';

const API_KEY_PREFIX = 'paq_';

export interface CreateApiKeyResult {
  id: string;
  name: string;
  scopes: ApiKeyScope[];
  keyPrefix: string;
  secret: string;
  expiresAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  listScopes(): readonly ApiKeyScope[] {
    return API_KEY_SCOPES;
  }

  async listKeys(tenantId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { tenantId, isActive: true },
      order: { createdAt: 'DESC' },
      select: [
        'id',
        'name',
        'scopes',
        'keyPrefix',
        'expiresAt',
        'lastUsedAt',
        'createdAt',
        'createdByMemberId',
      ],
    });
  }

  async createKey(
    tenantId: string,
    createdByMemberId: string,
    name: string,
    scopes: string[],
    expiresAt?: Date | null,
  ): Promise<CreateApiKeyResult> {
    const normalizedScopes = this.normalizeScopes(scopes);
    const rawSecret = `${API_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
    const keyPrefix = rawSecret.slice(0, 12);
    const keyHash = await argon2.hash(rawSecret);

    const saved = await this.apiKeyRepository.save({
      tenantId,
      createdByMemberId,
      name: name.trim(),
      keyPrefix,
      keyHash,
      scopes: normalizedScopes,
      expiresAt: expiresAt ?? null,
      isActive: true,
    });

    return {
      id: saved.id,
      name: saved.name,
      scopes: normalizedScopes,
      keyPrefix: saved.keyPrefix,
      secret: rawSecret,
      expiresAt: saved.expiresAt,
      createdAt: saved.createdAt,
    };
  }

  async revokeKey(tenantId: string, keyId: string): Promise<void> {
    const key = await this.apiKeyRepository.findOne({ where: { id: keyId, tenantId } });
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    key.isActive = false;
    await this.apiKeyRepository.save(key);
  }

  async validateKey(rawKey: string): Promise<ApiKey | null> {
    if (!rawKey.startsWith(API_KEY_PREFIX)) {
      return null;
    }

    const keyPrefix = rawKey.slice(0, 12);
    const candidates = await this.apiKeyRepository.find({
      where: { keyPrefix, isActive: true },
      relations: ['createdByMember', 'createdByMember.user'],
    });

    for (const candidate of candidates) {
      if (!(await argon2.verify(candidate.keyHash, rawKey))) {
        continue;
      }
      if (candidate.expiresAt && candidate.expiresAt < new Date()) {
        return null;
      }
      await this.apiKeyRepository.update(candidate.id, { lastUsedAt: new Date() });
      return candidate;
    }

    return null;
  }

  assertScopes(key: ApiKey, required: ApiKeyScope[]): void {
    const granted = new Set(key.scopes);
    const missing = required.filter((scope) => !granted.has(scope));
    if (missing.length > 0) {
      throw new ForbiddenException({
        message: 'API key lacks required scopes',
        code: 'API_KEY_SCOPE_DENIED',
        missingScopes: missing,
      });
    }
  }

  private normalizeScopes(scopes: string[]): ApiKeyScope[] {
    if (!scopes?.length) {
      throw new BadRequestException('At least one scope is required');
    }

    const normalized: ApiKeyScope[] = [];
    for (const scope of scopes) {
      if (!isApiKeyScope(scope)) {
        throw new BadRequestException(`Invalid scope: ${scope}`);
      }
      if (!normalized.includes(scope)) {
        normalized.push(scope);
      }
    }

    const hasHighRisk = normalized.some((scope) =>
      (HIGH_RISK_API_KEY_SCOPES as readonly string[]).includes(scope),
    );
    if (hasHighRisk && !normalized.includes('agent:actions')) {
      throw new BadRequestException(
        'High-risk scopes require explicitly including agent:actions',
      );
    }

    return normalized;
  }
}
