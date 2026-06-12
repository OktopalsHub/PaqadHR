import { Logger } from '@nestjs/common';
import { EnvironmentValidationConfig } from "../interfaces/environment-validation-config.interface";

export class EnvironmentValidationService {
  private readonly logger = new Logger(EnvironmentValidationService.name);
  private readonly validationConfig: EnvironmentValidationConfig = {
    critical: [
      'DATABASE_URL',
      'ACCESS_SECRET',
      'REFRESH_SECRET',
      'NODE_ENV',
      'BASE_URL',
      'FRONTEND_URL',
      'PORT',
      'ENCRYPTION_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_CALLBACK_URL',
      'ALLOWED_ORIGINS',
    ],
    productionRequired: [
      'ZEPTOMAIL_API_KEY',
      'DEFAULT_FROM_EMAIL',
    ],
    neverAllowFallbacks: [
      'DATABASE_URL',
      'ACCESS_SECRET',
      'REFRESH_SECRET',
      'ENCRYPTION_KEY',
      'NODE_ENV',
      'BASE_URL',
      'FRONTEND_URL',
      'PORT',
      'ALLOWED_ORIGINS',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_CALLBACK_URL',
    ],
    customValidations: {
      DATABASE_URL: (value) =>
        value.startsWith('postgresql://') || value.startsWith('postgres://'),
      BASE_URL: (value) =>
        value.startsWith('http://') || value.startsWith('https://'),
      FRONTEND_URL: (value) =>
        value.startsWith('http://') || value.startsWith('https://'),
      NODE_ENV: (value) => ['development', 'production'].includes(value),
      ENCRYPTION_KEY: (value) => value.length >= 32,
      DEFAULT_FROM_EMAIL: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),

      PORT: (value) =>
        !isNaN(Number(value)) && Number(value) > 0 && Number(value) < 65536,
    },
    minLengthRequirements: {
      ACCESS_SECRET: 32,
      REFRESH_SECRET: 32,
      ENCRYPTION_KEY: 32,
      GOOGLE_CLIENT_SECRET: 10,
      ZEPTOMAIL_API_KEY: 10,
    },
  };
  validateEnvironment(): void {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    const errors: string[] = [];
    const warnings: string[] = [];
    this.logger.log(
      `Validating environment variables for ${nodeEnv} environment...`,
    );
    this.validateCriticalVariables(errors);
    if (isProduction) {
      this.validateProductionVariables(errors, warnings);
    }
    this.validateCustomRules(errors);
    this.validateMinimumLengths(errors);
    this.validateNoFallbackValues(errors, warnings);
    if (isProduction) {
      this.validatePaymentProviders(warnings);
    }
    if (warnings.length > 0) {
      warnings.forEach((warning) => this.logger.warn(warning));
    }
    if (errors.length > 0) {
      const errorMessage = `Environment validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    this.logger.log('✅ Environment validation passed');
    this.logValidationSummary();
  }
  private logValidationSummary(): void {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    this.logger.log(
      `📋 Environment Validation Summary for ${nodeEnv.toUpperCase()}:`,
    );
    this.logger.log(
      `   ✅ Critical variables: ${this.validationConfig.critical.length} validated`,
    );
    this.logger.log(
      `   ✅ No-fallback variables: ${this.validationConfig.neverAllowFallbacks.length} validated`,
    );
    if (isProduction) {
      this.logger.log(
        `   ✅ Production-required variables: ${this.validationConfig.productionRequired.length} validated`,
      );
    }
    this.logger.log(
      `   ✅ Custom validations: ${Object.keys(this.validationConfig.customValidations).length} rules applied`,
    );
    this.logger.log(
      `   ✅ Minimum length requirements: ${Object.keys(this.validationConfig.minLengthRequirements).length} validated`,
    );
    const configuredIntegrations: string[] = [];
    if (process.env.GOOGLE_CLIENT_ID)
      configuredIntegrations.push('Google OAuth');
    if (process.env.SLACK_CLIENT_ID) configuredIntegrations.push('Slack');
    if (process.env.ZEPTOMAIL_API_KEY)
      configuredIntegrations.push('Email (Zeptomail)');

    if (configuredIntegrations.length > 0) {
      this.logger.log(
        `   🔌 Configured integrations: ${configuredIntegrations.join(', ')}`,
      );
    }
  }
  private validateCriticalVariables(errors: string[]): void {
    for (const variable of this.validationConfig.critical) {
      const value = process.env[variable];
      if (!value || value.trim() === '') {
        errors.push(`Critical environment variable ${variable} is not set`);
      }
    }
  }
  private validateProductionVariables(
    errors: string[],
    warnings: string[],
  ): void {
    for (const variable of this.validationConfig.productionRequired) {
      const value = process.env[variable];
      if (!value || value.trim() === '') {
        warnings.push(`Production environment variable ${variable} is not set`);
      }
    }
    const suspiciousValues = [
      'localhost',
      'example.com',
      'test',
      'development',
      'your-',
      'changeme',
      'password',
      '123456',
    ];
    Object.keys(process.env).forEach((key) => {
      const value = process.env[key] || '';
      if (
        suspiciousValues.some((suspicious) =>
          value.toLowerCase().includes(suspicious),
        )
      ) {
        warnings.push(
          `Environment variable ${key} contains suspicious value that looks like a placeholder: ${value}`,
        );
      }
    });
  }
  private validateCustomRules(errors: string[]): void {
    Object.entries(this.validationConfig.customValidations).forEach(
      ([variable, validator]) => {
        const value = process.env[variable];
        if (value && !validator(value)) {
          errors.push(
            `Environment variable ${variable} has invalid format: ${value}`,
          );
        }
      },
    );
  }
  private validateMinimumLengths(errors: string[]): void {
    Object.entries(this.validationConfig.minLengthRequirements).forEach(
      ([variable, minLength]) => {
        const value = process.env[variable];
        if (value && value.length < minLength) {
          errors.push(
            `Environment variable ${variable} must be at least ${minLength} characters long (current: ${value.length})`,
          );
        }
      },
    );
  }
  private validateNoFallbackValues(errors: string[], warnings: string[]): void {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    const suspiciousPatterns = [
      'your-',
      'changeme',
      'replace-me',
      'example',
      'test-key',
      'dummy',
      'placeholder',
      'password',
      '123456',
      'secret-here',
      'key-here',
    ];
    const productionOnlyPatterns = [
      'localhost:3000',
      'localhost:9001',
      'localhost',
    ];
    this.validationConfig.neverAllowFallbacks.forEach((variable) => {
      const value = process.env[variable];
      if (!value || value.trim() === '') {
        errors.push(
          `Critical environment variable ${variable} must be explicitly set - no fallbacks allowed`,
        );
        return;
      }
      const lowerValue = value.toLowerCase();
      const hasSuspiciousPattern = suspiciousPatterns.some((pattern) =>
        lowerValue.includes(pattern.toLowerCase()),
      );
      let hasProductionSuspiciousPattern = false;
      if (isProduction) {
        if (variable === 'ALLOWED_ORIGINS') {
          const origins = value.split(',').map((o) => o.trim().toLowerCase());
          const hasProductionOrigin = origins.some(
            (origin) =>
              !origin.includes('localhost') &&
              (origin.startsWith('https://') || origin.startsWith('http://')),
          );
          hasProductionSuspiciousPattern = !hasProductionOrigin;
        } else if (variable === 'GOOGLE_CALLBACK_URL') {
          hasProductionSuspiciousPattern = lowerValue.includes('localhost');
        } else {
          hasProductionSuspiciousPattern = productionOnlyPatterns.some(
            (pattern) => lowerValue.includes(pattern.toLowerCase()),
          );
        }
      }
      if (hasSuspiciousPattern) {
        if (isProduction) {
          errors.push(
            `Critical environment variable ${variable} appears to contain a placeholder value: ${value}`,
          );
        } else {
          warnings.push(
            `Environment variable ${variable} appears to contain a placeholder value: ${value}`,
          );
        }
      } else if (hasProductionSuspiciousPattern) {
        if (variable === 'ALLOWED_ORIGINS') {
          warnings.push(
            `ALLOWED_ORIGINS should include production URLs in production environment: ${value}`,
          );
        } else if (variable === 'GOOGLE_CALLBACK_URL') {
          warnings.push(
            `GOOGLE_CALLBACK_URL should use production URL in production environment: ${value}`,
          );
        } else {
          errors.push(
            `Critical environment variable ${variable} contains development-like value in production: ${value}`,
          );
        }
      }
    });
  }
  private validatePaymentProviders(_warnings: string[]): void {
  }
  getRequired(key: string): string {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value.trim();
  }
  getOptional(key: string, defaultValue: string = ''): string {
    return process.env[key]?.trim() || defaultValue;
  }
  getRequiredNumber(key: string): number {
    const value = this.getRequired(key);
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(
        `Environment variable ${key} must be a valid number, got: ${value}`,
      );
    }
    return num;
  }
  getOptionalNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      return defaultValue;
    }
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(
        `Environment variable ${key} must be a valid number, got: ${value}`,
      );
    }
    return num;
  }
  getRequiredBoolean(key: string): boolean {
    const value = this.getRequired(key);
    return value.toLowerCase() === 'true';
  }
  getOptionalBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      return defaultValue;
    }
    return value.toLowerCase() === 'true';
  }
  generateRequiredVariablesChecklist(): string {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    let checklist = `\n🔧 REQUIRED ENVIRONMENT VARIABLES CHECKLIST (${nodeEnv.toUpperCase()})\n`;
    checklist += '='.repeat(60) + '\n\n';
    checklist += '📋 CRITICAL VARIABLES (Required in ALL environments):\n';
    this.validationConfig.critical.forEach((variable) => {
      const isSet =
        process.env[variable] && process.env[variable].trim() !== '';
      checklist += `   ${isSet ? '✅' : '❌'} ${variable}\n`;
    });
    if (isProduction) {
      checklist += '\n🏭 PRODUCTION-ONLY VARIABLES:\n';
      this.validationConfig.productionRequired.forEach((variable) => {
        const isSet =
          process.env[variable] && process.env[variable].trim() !== '';
        checklist += `   ${isSet ? '✅' : '❌'} ${variable}\n`;
      });
    }
    checklist += '\n🚫 VARIABLES THAT MUST NEVER HAVE FALLBACKS:\n';
    this.validationConfig.neverAllowFallbacks.forEach((variable) => {
      const value = process.env[variable];
      const isSet = value && value.trim() !== '';
      const hasPlaceholder =
        value &&
        ['your-', 'changeme', 'example'].some((pattern) =>
          value.toLowerCase().includes(pattern),
        );
      const hasLocalhostInProd =
        isProduction && value && value.toLowerCase().includes('localhost');
      if (!isSet) {
        checklist += `   ❌ ${variable} - NOT SET\n`;
      } else if (hasPlaceholder) {
        checklist += `   ⚠️  ${variable} - APPEARS TO BE PLACEHOLDER\n`;
      } else if (hasLocalhostInProd) {
        checklist += `   ⚠️  ${variable} - LOCALHOST IN PRODUCTION\n`;
      } else {
        checklist += `   ✅ ${variable}\n`;
      }
    });
    checklist +=
      '\n💡 TIP: Copy .env.example to .env and fill in all required values\n';
    checklist += '💡 TIP: Use strong, unique values for all secrets\n';
    checklist += '💡 TIP: Never commit real secrets to version control\n';
    return checklist;
  }
}
