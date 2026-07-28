import * as crypto from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ENVIRONMENT } from '../config/env.config';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly encryptionKey: Buffer;
  constructor() {
    const key = ENVIRONMENT.ENCRYPTION.KEY;
    if (key.length !== 32) {
      throw new BadRequestException('Encryption key must be exactly 32 characters long');
    }
    this.encryptionKey = Buffer.from(key, 'utf8');
  }
  encrypt(text: string): string {
    if (!text || text.trim() === '') {
      return text;
    }
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const tag = cipher.getAuthTag();
      return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`;
    } catch {
      throw new BadRequestException('Encryption operation failed');
    }
  }
  decrypt(encryptedText: string): string {
    if (!encryptedText || encryptedText.trim() === '') {
      return encryptedText;
    }
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new BadRequestException('Invalid encrypted data format');
      }
      const iv = Buffer.from(parts[0], 'base64');
      const tag = Buffer.from(parts[1], 'base64');
      const encrypted = parts[2];
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      throw new BadRequestException('Decryption operation failed');
    }
  }
  isEncrypted(text: string): boolean {
    if (!text) return false;
    const parts = text.split(':');
    return parts.length === 3;
  }
}
