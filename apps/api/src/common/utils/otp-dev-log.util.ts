import { Logger } from '@nestjs/common';

const logger = new Logger('OtpDevLog');

/** OTPs are only printed to the console when the API runs in development mode. */
export function isOtpConsoleLoggingEnabled(): boolean {
  return (process.env.NODE_ENV || 'development') === 'development';
}

export function logOtpForLocalDevelopment(email: string, code: string, purpose: string): void {
  if (!isOtpConsoleLoggingEnabled()) return;
  logger.log(`[DEV] ${purpose} OTP for ${email}: ${code}`);
}
