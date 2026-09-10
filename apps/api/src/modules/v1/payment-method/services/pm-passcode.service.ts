import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PasscodeChangeReason } from 'src/common/enums/passcode-change-reason.enum';
import { Repository } from 'typeorm';
import type { PasscodeChangeDto } from '../dto/payment-method.dto';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentMethodPasscodeHistory } from '../entities/payment-method-passcode-history.entity';
import { PaymentSecurityService } from './payment-security.service';

@Injectable()
export class PmPasscodeService {
  constructor(
    @InjectRepository(PaymentMethod) private readonly repo: Repository<PaymentMethod>,
    @InjectRepository(PaymentMethodPasscodeHistory)
    private readonly historyRepo: Repository<PaymentMethodPasscodeHistory>,
    private readonly paymentSecurityService: PaymentSecurityService,
  ) {}

  async changePasscode(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    dto: PasscodeChangeDto,
  ): Promise<void> {
    const pm = await this.repo.findOne({ where: { id: paymentMethodId, tenantId, memberId } });
    if (!pm) throw new NotFoundException('Payment method not found');
    await this.paymentSecurityService.changePasscode(
      memberId,
      tenantId,
      dto.currentPasscode,
      dto.newPasscode,
    );
    await this.trackPasscodeChange(
      paymentMethodId,
      memberId,
      PasscodeChangeReason.USER_REQUESTED,
      'Member payment passcode changed',
    );
  }

  async getPasscodeHistory(paymentMethodId: string, tenantId: string, memberId: string) {
    const pm = await this.repo.findOne({ where: { id: paymentMethodId, tenantId, memberId } });
    if (!pm) throw new NotFoundException('Payment method not found');
    return this.historyRepo.find({
      where: { paymentMethodId },
      order: { changedAt: 'DESC' },
      take: 10,
    });
  }

  private async trackPasscodeChange(
    paymentMethodId: string,
    memberId: string,
    reason: PasscodeChangeReason,
    notes?: string,
  ) {
    try {
      await this.historyRepo.save(
        this.historyRepo.create({
          paymentMethodId,
          memberId,
          reason,
          changedAt: new Date(),
          notes,
          wasForced:
            reason === PasscodeChangeReason.SECURITY_RESET ||
            reason === PasscodeChangeReason.ADMIN_RESET,
        }),
      );
    } catch {
      // ignore tracking errors
    }
  }
}
