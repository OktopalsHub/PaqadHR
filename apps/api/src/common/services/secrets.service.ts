import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EnvironmentValidationService } from '../config/environment-validation.service';
import { SecretConfig } from "../interfaces/secret-config.interface";

@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);
  private secrets: SecretConfig;
  private envValidator = new EnvironmentValidationService();
  constructor() {
    this.loadSecrets();
  }
  private loadSecrets(): void {
    try {
      this.secrets = {
        jwt: {
          accessSecret: this.envValidator.getRequired('ACCESS_SECRET'),
          refreshSecret: this.envValidator.getRequired('REFRESH_SECRET'),
        },
        database: {
          url: this.envValidator.getRequired('DATABASE_URL'),
          testUrl: this.envValidator.getOptional('TEST_DATABASE_URL'),
        },
        oauth: {
          google: {
            clientId: this.envValidator.getRequired('GOOGLE_CLIENT_ID'),
            clientSecret: this.envValidator.getRequired('GOOGLE_CLIENT_SECRET'),
          },
        },
        integrations: {
          slack: {
            clientId: this.envValidator.getOptional('SLACK_CLIENT_ID'),
            clientSecret: this.envValidator.getOptional('SLACK_CLIENT_SECRET'),
            signingSecret:
              this.envValidator.getOptional('SLACK_SIGNING_SECRET') ||
              this.envValidator.getOptional('SLACK_WEBHOOK_SECRET', ''),
          },
        },
        email: {
          zeptomailApiKey: this.getEmailApiKey(),
          defaultFromEmail: this.getDefaultFromEmail(),
        },
        encryption: {
          key: this.envValidator.getRequired('ENCRYPTION_KEY'),
        },
        payments: {
          nomba: {
            apiKey: this.envValidator.getOptional('NOMBA_API_KEY'),
            secretKey: this.envValidator.getOptional('NOMBA_SECRET_KEY'),
            webhookSecret: this.envValidator.getOptional(
              'NOMBA_WEBHOOK_SECRET',
            ),
          },
        },
      };
      this.validateSecrets();
    } catch (error) {
      this.logger.error('Failed to load secrets:', error);
      throw new BadRequestException('Secret configuration failed');
    }
  }
  private getEmailApiKey(): string {
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      return this.envValidator.getRequired('ZEPTOMAIL_API_KEY');
    }
    return this.envValidator.getOptional('ZEPTOMAIL_API_KEY');
  }
  private getDefaultFromEmail(): string {
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      return this.envValidator.getRequired('DEFAULT_FROM_EMAIL');
    }
    return this.envValidator.getOptional(
      'DEFAULT_FROM_EMAIL',
      'noreply@localhost',
    );
  }
  private validateSecrets(): void {
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      this.validateJwtSecrets();
    }
    this.validateDatabaseUrl();
    this.validateEncryptionKey();
  }
  private validateJwtSecrets(): void {
    const minLength = 32;
    if (this.secrets.jwt.accessSecret.length < minLength) {
      throw new BadRequestException(
        `ACCESS_SECRET must be at least ${minLength} characters long in production`,
      );
    }
    if (this.secrets.jwt.refreshSecret.length < minLength) {
      throw new BadRequestException(
        `REFRESH_SECRET must be at least ${minLength} characters long in production`,
      );
    }
    if (this.secrets.jwt.accessSecret === this.secrets.jwt.refreshSecret) {
      throw new BadRequestException('ACCESS_SECRET and REFRESH_SECRET must be different');
    }
  }
  private validateDatabaseUrl(): void {
    const dbUrl = this.secrets.database.url;
    if (
      !dbUrl.startsWith('postgresql://') &&
      !dbUrl.startsWith('postgres://')
    ) {
      throw new BadRequestException(
        'DATABASE_URL must be a valid PostgreSQL connection string',
      );
    }
  }
  private validateEncryptionKey(): void {
    const encryptionKey = this.secrets.encryption.key;
    if (encryptionKey.length !== 32) {
      throw new BadRequestException('ENCRYPTION_KEY must be exactly 32 characters long');
    }
  }
  getSecrets(): SecretConfig {
    return this.secrets;
  }
  getJwtSecrets() {
    return this.secrets.jwt;
  }
  getDatabaseConfig() {
    return this.secrets.database;
  }
  getOAuthConfig() {
    return this.secrets.oauth;
  }
  getIntegrationSecrets() {
    return this.secrets.integrations;
  }
  getPaymentSecrets() {
    return this.secrets.payments;
  }
  getEmailConfig() {
    return this.secrets.email;
  }
  getEncryptionConfig() {
    return this.secrets.encryption;
  }
}
