import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
@Injectable()
export class EmailHashService {
  private readonly hashSalt: string;
  constructor() {
    this.hashSalt =
      process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars';
    if (this.hashSalt.length < 32) {
      throw new BadRequestException('ENCRYPTION_KEY must be exactly 32 characters long');
    }
  }
  hashEmail(email: string): string {
    if (!email) return '';
    const normalizedEmail = email.toLowerCase().trim();
    return crypto
      .createHmac('sha256', this.hashSalt)
      .update(normalizedEmail)
      .digest('hex');
  }
  verifyEmailHash(email: string, hash: string): boolean {
    return this.hashEmail(email) === hash;
  }
}
