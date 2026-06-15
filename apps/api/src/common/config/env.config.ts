import * as dotenv from 'dotenv';
import { EnvironmentValidationService } from './environment-validation.service';
import { resolveTrustedOrigins } from './trusted-origins';

dotenv.config();

const envValidator = new EnvironmentValidationService();

type JwtExpiresIn = `${number}${'s' | 'm' | 'h' | 'd'}`;

function resolveJwtAccessExpiresIn(): string | number {
  const raw = process.env.ACCESS_EXPIRES_IN;
  if (!raw) return '1h';
  if (/^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (n >= 10000) return Math.floor(n / 1000);
    return n;
  }
  return raw as JwtExpiresIn;
}

export interface IEnvironment {
  APP: {
    NODE_ENV: string;
    PORT: number | string;
    FRONTEND_URL: string;
    BASE_URL: string;
    TRUSTED_ORIGINS: string[];
  };
  DB: {
    URL: string;
  };
  JWT: {
    ACCESS_SECRET: string;
    REFRESH_SECRET: string;
    ACCESS_EXPIRES_IN: string | number;
  };
  GOOGLE: {
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    CALLBACK_URL: string;
  };
  SLACK: {
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    SIGNING_SECRET: string;
    WEBHOOK_URL: string;
  };
  CLOUDFLARE_R2: {
    ACCOUNT_ID: string;
    PUBLIC_ID?: string;
    CUSTOM_DOMAIN?: string;
    ACCESS_KEY_ID: string;
    SECRET_ACCESS_KEY: string;
    BUCKET_NAME: string;
  };
  ENCRYPTION: {
    KEY: string;
  };
  PAYROLL: {
    DISBURSEMENT_MODE: 'manual' | 'gateway';
  };
  BILLING: {
    MODE: 'trial' | 'manual' | 'open';
  };
}

export const ENVIRONMENT: IEnvironment = {
  APP: {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: envValidator.getOptionalNumber('PORT', 9001),
    FRONTEND_URL: envValidator.getOptional('FRONTEND_URL', 'http://localhost:3000'),
    BASE_URL: envValidator.getOptional('BASE_URL', 'http://localhost:9001'),
    TRUSTED_ORIGINS: resolveTrustedOrigins(),
  },
  DB: {
    URL: process.env.DATABASE_URL || '',
  },
  JWT: {
    ACCESS_SECRET: envValidator.getOptional('ACCESS_SECRET', 'dev-access-secret'),
    REFRESH_SECRET: envValidator.getOptional('REFRESH_SECRET', 'dev-refresh-secret'),
    ACCESS_EXPIRES_IN: resolveJwtAccessExpiresIn(),
  },
  GOOGLE: {
    CLIENT_ID: envValidator.getOptional('GOOGLE_CLIENT_ID', ''),
    CLIENT_SECRET: envValidator.getOptional('GOOGLE_CLIENT_SECRET', ''),
    CALLBACK_URL: envValidator.getOptional('GOOGLE_CALLBACK_URL', ''),
  },
  SLACK: {
    CLIENT_ID: envValidator.getOptional('SLACK_CLIENT_ID', ''),
    CLIENT_SECRET: envValidator.getOptional('SLACK_CLIENT_SECRET', ''),
    SIGNING_SECRET:
      envValidator.getOptional('SLACK_SIGNING_SECRET') ||
      envValidator.getOptional('SLACK_WEBHOOK_SECRET', ''),
    WEBHOOK_URL: envValidator.getOptional('SLACK_WEBHOOK_URL', ''),
  },
  CLOUDFLARE_R2: {
    ACCOUNT_ID: envValidator.getRequired('CLOUDFLARE_R2_ACCOUNT_ID'),
    PUBLIC_ID: envValidator.getOptional('CLOUDFLARE_R2_PUBLIC_ID'),
    CUSTOM_DOMAIN: envValidator.getOptional('CLOUDFLARE_R2_CUSTOM_DOMAIN'),
    ACCESS_KEY_ID: envValidator.getRequired('CLOUDFLARE_R2_ACCESS_KEY_ID'),
    SECRET_ACCESS_KEY: envValidator.getRequired('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
    BUCKET_NAME: envValidator.getRequired('CLOUDFLARE_R2_BUCKET_NAME'),
  },
  ENCRYPTION: {
    KEY: envValidator.getOptional('ENCRYPTION_KEY', '01234567890123456789012345678901'),
  },
  PAYROLL: {
    DISBURSEMENT_MODE:
      (process.env.PAYROLL_DISBURSEMENT_MODE || 'manual').toLowerCase() === 'gateway'
        ? 'gateway'
        : 'manual',
  },
  BILLING: {
    MODE: (() => {
      const mode = (process.env.BILLING_MODE || 'trial').toLowerCase();
      if (mode === 'manual' || mode === 'open') return mode;
      return 'trial';
    })(),
  },
};
