import type { ApiKeyScope } from '@paqadhr/contracts';
import type { Request } from 'express';

export type AuthType = 'user' | 'api_key';

export interface IAuthenticatedUserRequest extends Request {
  auth: {
    principalId: string;
    email: string;
    role: string;
    authType?: AuthType;
    apiKeyId?: string;
    tenantId?: string;
    memberId?: string;
    scopes?: ApiKeyScope[];
  };
}
