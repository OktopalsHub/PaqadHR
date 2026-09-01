import * as dotenv from 'dotenv';
import * as env from './env.util';
import { resolveTrustedOrigins } from './trusted-origins';

dotenv.config();

type JwtExpiresIn = `${number}${'s' | 'm' | 'h' | 'd'}`;

function resolveJwtAccessExpiresIn(): string | number {
  const raw = process.env.ACCESS_EXPIRES_IN?.trim();
  if (!raw) return '15m';
  if (/^\d+$/.test(raw)) {
    // L-6: Numeric ms is deprecated — use duration string like 15m; keep compat for 900000→900s
    // eslint-disable-next-line no-console
    console.warn(
      '[deprecated] ACCESS_EXPIRES_IN numeric value is deprecated — use duration string e.g., 15m',
    );
    const n = parseInt(raw, 10);
    if (n >= 10000) return Math.floor(n / 1000);
    return n;
  }
  if (!/^\d+(s|m|h|d)$/.test(raw.toLowerCase())) {
    // eslint-disable-next-line no-console
    console.warn(`[warn] ACCESS_EXPIRES_IN "${raw}" is not a valid duration, using 15m`);
    return '15m';
  }
  return raw.toLowerCase() as JwtExpiresIn;
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
    CALENDAR_API_KEY: string;
  };
  SLACK: {
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    SIGNING_SECRET: string;
  };
  R2: {
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
}

export const ENVIRONMENT: IEnvironment = {
  APP: {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: env.getOptionalNumber('PORT', 9001),
    FRONTEND_URL: env.getOptional('FRONTEND_URL', 'http://localhost:3000'),
    BASE_URL: env.getOptional('BASE_URL', 'http://localhost:9001'),
    TRUSTED_ORIGINS: resolveTrustedOrigins(),
  },
  DB: {
    URL: process.env.DATABASE_URL || '',
  },
  JWT: {
    ACCESS_SECRET: env.getRequired('ACCESS_SECRET'),
    REFRESH_SECRET: env.getRequired('REFRESH_SECRET'),
    ACCESS_EXPIRES_IN: resolveJwtAccessExpiresIn(),
  },
  GOOGLE: {
    CLIENT_ID: env.getOptional('GOOGLE_CLIENT_ID', ''),
    CLIENT_SECRET: env.getOptional('GOOGLE_CLIENT_SECRET', ''),
    CALLBACK_URL: env.getOptional('GOOGLE_CALLBACK_URL', ''),
    CALENDAR_API_KEY: env.getOptional('GOOGLE_CALENDAR_API_KEY', ''),
  },
  SLACK: {
    CLIENT_ID: env.getOptional('SLACK_CLIENT_ID', ''),
    CLIENT_SECRET: env.getOptional('SLACK_CLIENT_SECRET', ''),
    SIGNING_SECRET:
      env.getOptional('SLACK_SIGNING_SECRET') || env.getOptional('SLACK_WEBHOOK_SECRET', ''),
  },
  R2: {
    ACCOUNT_ID: env.getRequired('R2_ACCOUNT_ID'),
    PUBLIC_ID: env.getOptional('R2_PUBLIC_ID'),
    CUSTOM_DOMAIN: env.getOptional('R2_CUSTOM_DOMAIN'),
    ACCESS_KEY_ID: env.getRequired('R2_ACCESS_KEY_ID'),
    SECRET_ACCESS_KEY: env.getRequired('R2_SECRET_ACCESS_KEY'),
    BUCKET_NAME: env.getRequired('R2_BUCKET_NAME'),
  },
  ENCRYPTION: {
    KEY: env.getRequired('ENCRYPTION_KEY'),
  },
};
