import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PasswordService } from 'src/common/utils';
import type { PaymentSecurity } from '../entities/payment-security.entity';
import { PaymentSecurityRepository } from '../repositories/payment-security.repository';

@Injectable()
export class PaymentSecurityService {
  constructor(private readonly paymentSecurityRepo: PaymentSecurityRepository) {}

  async hasPasscode(memberId: string, tenantId: string): Promise<boolean> {
    const security = await this.paymentSecurityRepo.findOne({
      where: { member: { id: memberId, tenantId } },
      select: ['id'],
    });
    return Boolean(security);
  }

  async isLocked(memberId: string, tenantId: string): Promise<boolean> {
    const security = await this.paymentSecurityRepo.findOne({
      where: { member: { id: memberId, tenantId } },
      select: ['id', 'passcodeLockedUntil'],
    });
    if (!security?.passcodeLockedUntil) return false;
    return security.passcodeLockedUntil > new Date();
  }

  async getLockedMemberIds(tenantId: string, memberIds: string[]): Promise<Set<string>> {
    if (memberIds.length === 0) return new Set();
    const rows = await this.paymentSecurityRepo
      .createQueryBuilder('ps')
      .innerJoin('ps.member', 'member')
      .where('member.tenantId = :tenantId', { tenantId })
      .andWhere('member.id IN (:...memberIds)', { memberIds })
      .andWhere('ps.passcodeLockedUntil IS NOT NULL')
      .andWhere('ps.passcodeLockedUntil > NOW()')
      .select('member.id', 'memberId')
      .getRawMany<{ memberId: string }>();
    return new Set(rows.map((row) => row.memberId));
  }

  /**
   * First-time: set passcode. Otherwise verify. Throws on invalid passcode.
   */
  async ensureOrVerifyPasscode(
    memberId: string,
    tenantId: string,
    plainPasscode: string,
  ): Promise<void> {
    if (!/^\d{6}$/.test(plainPasscode)) {
      throw new UnauthorizedException('Passcode must be exactly 6 digits');
    }
    const exists = await this.hasPasscode(memberId, tenantId);
    if (!exists) {
      await this.setPasscode(memberId, tenantId, plainPasscode);
      return;
    }
    const ok = await this.verifyPasscode(memberId, tenantId, plainPasscode);
    if (!ok) {
      throw new UnauthorizedException('Invalid passcode');
    }
  }

  async setPasscode(
    memberId: string,
    tenantId: string,
    plainPasscode: string,
  ): Promise<PaymentSecurity | null> {
    if (!/^\d{6}$/.test(plainPasscode)) {
      throw new UnauthorizedException('Passcode must be exactly 6 digits');
    }
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

  async changePasscode(
    memberId: string,
    tenantId: string,
    currentPasscode: string,
    newPasscode: string,
  ): Promise<void> {
    const ok = await this.verifyPasscode(memberId, tenantId, currentPasscode);
    if (!ok) {
      throw new UnauthorizedException('Invalid passcode');
    }
    await this.setPasscode(memberId, tenantId, newPasscode);
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
