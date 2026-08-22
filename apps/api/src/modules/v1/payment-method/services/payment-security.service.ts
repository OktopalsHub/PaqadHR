import { ForbiddenException, Injectable } from '@nestjs/common';
import { PasswordService } from 'src/common/utils';
import type { PaymentSecurity } from '../entities/payment-security.entity';
import { PaymentSecurityRepository } from '../repositories/payment-security.repository';

@Injectable()
export class PaymentSecurityService {
  constructor(private readonly paymentSecurityRepo: PaymentSecurityRepository) {}

  async setPasscode(
    memberId: string,
    tenantId: string,
    plainPasscode: string,
  ): Promise<PaymentSecurity | null> {
    const hashed = await PasswordService.hashPassword(plainPasscode);
    const security = await this.paymentSecurityRepo.findOne({
      where: { member: { id: memberId, tenantId } },
    });
    if (!security) {
      return this.paymentSecurityRepo.save(
        this.paymentSecurityRepo.create({
          member: { id: memberId },
          paymentPasscode: hashed,
          passcodeAttempts: 0,
          passcodeLockedUntil: null,
        }),
      );
    }
    await this.paymentSecurityRepo.update(security.id, {
      paymentPasscode: hashed,
      passcodeAttempts: 0,
      passcodeLockedUntil: null,
    });
    return this.paymentSecurityRepo.findOne({
      where: { id: security.id },
    });
  }

  async verifyPasscode(
    memberId: string,
    tenantId: string,
    plainPasscode: string,
  ): Promise<boolean> {
    const security = await this.paymentSecurityRepo.findOne({
      where: { member: { id: memberId, tenantId } },
      select: ['id', 'paymentPasscode', 'passcodeAttempts', 'passcodeLockedUntil'],
    });
    if (!security) throw new ForbiddenException('No payment security set up');
    if (security.passcodeLockedUntil && security.passcodeLockedUntil > new Date()) {
      throw new ForbiddenException('Account locked due to failed attempts');
    }
    const match = await PasswordService.verifyPassword(security.paymentPasscode, plainPasscode);
    if (!match) {
      security.passcodeAttempts += 1;
      if (security.passcodeAttempts >= 5) {
        const lockMinutes = 15;
        security.passcodeLockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
        security.passcodeAttempts = 0;
      }
      await this.paymentSecurityRepo.update(security.id, {
        passcodeAttempts: security.passcodeAttempts,
        passcodeLockedUntil: security.passcodeLockedUntil,
      });
      return false;
    }
    await this.paymentSecurityRepo.update(security.id, {
      passcodeAttempts: 0,
      passcodeLockedUntil: null,
    });
    return true;
  }
}
