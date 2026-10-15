import * as crypto from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ENVIRONMENT } from '../config/env.config';

@Injectable()
export class EmailHashService {
  private readonly hashSalt: string;
  constructor() {
    this.hashSalt = ENVIRONMENT.ENCRYPTION.KEY;
    if (this.hashSalt.length < 32) {
      throw new BadRequestException('ENCRYPTION_KEY must be exactly 32 characters long');
    }
  }
  hashEmail(email: string): string {
    if (!email) return '';
    const normalizedEmail = email.toLowerCase().trim();
    return crypto.createHmac('sha256', this.hashSalt).update(normalizedEmail).digest('hex');
  }
  verifyEmailHash(email: string, hash: string): boolean {
    return this.hashEmail(email) === hash;
  }
}
