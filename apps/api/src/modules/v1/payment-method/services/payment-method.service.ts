import { CreatePaymentMethodDto, UpdatePaymentMethodDto, PasscodeChangeDto } from '../dto/payment-method.dto';
import { PaymentMethodPasscodeHistory } from '../entities/payment-method-passcode-history.entity';
import { PaymentMethod } from '../entities/payment-method.entity';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PasswordService } from 'src/common/utils';
import { PaymentMethodType } from 'src/common/enums';
import { Repository } from 'typeorm';
import { PasscodeChangeReason } from "../../../../common/enums/passcode-change-reason.enum";
import { PaymentMethodStatus } from "../../../../common/enums/payment-method-status.enum";
import { PaymentMethodSummary } from '../../../../common/interfaces/payment-method-summary.interface';
import { PaymentProviderFactoryService } from '../../../../common/services/payment-provider-factory.service';

@Injectable()
export class PaymentMethodService {
  private readonly logger = new Logger(PaymentMethodService.name);
  private readonly maxFailedAttempts = 5;
  private readonly lockDurationMinutes = 30;
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(PaymentMethodPasscodeHistory)
    private readonly passcodeHistoryRepository: Repository<PaymentMethodPasscodeHistory>,
    private readonly paymentProviderFactory: PaymentProviderFactoryService,
  ) {}
  async createPaymentMethod(
    tenantId: string,
    memberId: string,
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    try {
      await this.validatePaymentMethodData(dto);
      if (!dto.passcode) {
        throw new BadRequestException(
          'Passcode is required to create payment method',
        );
      }
      if (dto.passcode.length !== 6) {
        throw new BadRequestException('Passcode must be exactly 6 characters');
      }
      const passcodeHash = await PasswordService.hashPassword(dto.passcode);
      if (dto.isPrimary) {
        await this.unsetPrimaryMethods(tenantId, memberId, dto.currency);
      }
      const paymentMethod = this.paymentMethodRepository.create({
        tenantId,
        memberId,
        type: dto.type || PaymentMethodType.BANK,
        currency: dto.currency.toUpperCase(),
        displayName: dto.displayName,
        bankName: dto.bankName,
        bankCode: dto.bankCode,
        accountName: dto.accountName,
        accountNumber: dto.accountNumber,
        country: dto.country,
        isPrimary: dto.isPrimary || false,
        status: PaymentMethodStatus.PENDING_VERIFICATION,
        passcodeHash,
        passcodeSetAt: new Date(),
        lastPasscodeChange: new Date(),
        metadata: dto.metadata,
      });
      const savedMethod =
        await this.paymentMethodRepository.save(paymentMethod);
      await this.trackPasscodeChange(
        savedMethod.id,
        memberId,
        PasscodeChangeReason.INITIAL_SETUP,
        'Initial passcode setup during payment method creation',
      );
      this.logger.log(
        `Payment method created for member ${memberId}: ${savedMethod.id}`,
      );
      return savedMethod;
    } catch (error) {
      this.logger.error('Error creating payment method:', error);
      throw error;
    }
  }
  async updatePaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, tenantId, memberId },
    });
    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }
    await this.verifyPasscode(paymentMethod, dto.currentPasscode);
    if (dto.isPrimary && !paymentMethod.isPrimary && paymentMethod.currency) {
      await this.unsetPrimaryMethods(
        tenantId,
        memberId,
        paymentMethod.currency,
      );
    }
    Object.assign(paymentMethod, {
      displayName: dto.displayName ?? paymentMethod.displayName,
      bankName: dto.bankName ?? paymentMethod.bankName,
      bankCode: dto.bankCode ?? paymentMethod.bankCode,
      accountName: dto.accountName ?? paymentMethod.accountName,
      accountNumber: dto.accountNumber ?? paymentMethod.accountNumber,
      country: dto.country ?? paymentMethod.country,
      isPrimary: dto.isPrimary ?? paymentMethod.isPrimary,
      metadata: dto.metadata ?? paymentMethod.metadata,
    });
    if (dto.newPasscode) {
      if (dto.newPasscode.length !== 6) {
        throw new BadRequestException(
          'New passcode must be exactly 6 characters',
        );
      }
      paymentMethod.passcodeHash = await PasswordService.hashPassword(
        dto.newPasscode,
      );
      paymentMethod.lastPasscodeChange = new Date();
      await this.trackPasscodeChange(
        paymentMethodId,
        memberId,
        PasscodeChangeReason.USER_REQUESTED,
        'Passcode changed during payment method update',
      );
      this.logger.log(`Passcode changed for payment method ${paymentMethodId}`);
    }
    if (dto.accountNumber) {
      paymentMethod.status = PaymentMethodStatus.PENDING_VERIFICATION;
      paymentMethod.verifiedAt = null;
    }
    const updatedMethod =
      await this.paymentMethodRepository.save(paymentMethod);
    this.logger.log(`Payment method updated: ${paymentMethodId}`);
    return updatedMethod;
  }
  async changePasscode(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    dto: PasscodeChangeDto,
  ): Promise<void> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, tenantId, memberId },
    });
    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }
    await this.verifyPasscode(paymentMethod, dto.currentPasscode);
    if (dto.newPasscode.length !== 6) {
      throw new BadRequestException(
        'New passcode must be exactly 6 characters',
      );
    }
    paymentMethod.passcodeHash = await PasswordService.hashPassword(
      dto.newPasscode,
    );
    paymentMethod.lastPasscodeChange = new Date();
    paymentMethod.failedPasscodeAttempts = 0;
    paymentMethod.lockedUntil = null;
    await this.paymentMethodRepository.save(paymentMethod);
    await this.trackPasscodeChange(
      paymentMethodId,
      memberId,
      PasscodeChangeReason.USER_REQUESTED,
      'Passcode changed via dedicated passcode change endpoint',
    );
    this.logger.log(`Passcode changed for payment method ${paymentMethodId}`);
  }
  async getPaymentMethods(
    tenantId: string,
    memberId: string,
    currency?: string,
  ): Promise<PaymentMethodSummary[]> {
    const query = this.paymentMethodRepository
      .createQueryBuilder('pm')
      .where('pm.tenantId = :tenantId', { tenantId })
      .andWhere('pm.memberId = :memberId', { memberId });
    if (currency) {
      query.andWhere('pm.currency = :currency', {
        currency: currency.toUpperCase(),
      });
    }
    const methods = await query
      .orderBy('pm.isPrimary', 'DESC')
      .addOrderBy('pm.createdAt', 'DESC')
      .getMany();
    return methods.map((method) => ({
      id: method.id,
      type: method.type,
      currency: method.currency || 'USD',
      displayInfo: method.displayInfo,
      status: method.status,
      isPrimary: method.isPrimary,
      isVerified: method.isVerified,
      canReceivePayments: method.canReceivePayments,
      lastUsedAt: method.lastUsedAt,
      createdAt: method.createdAt,
    }));
  }
  async getPrimaryPaymentMethod(
    tenantId: string,
    memberId: string,
    currency: string,
  ): Promise<PaymentMethod | null> {
    return this.paymentMethodRepository.findOne({
      where: {
        tenantId,
        memberId,
        currency: currency.toUpperCase(),
        isPrimary: true,
        status: PaymentMethodStatus.VERIFIED,
      },
    });
  }
  async deletePaymentMethod(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
    passcode?: string,
  ): Promise<void> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, tenantId, memberId },
    });
    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }
    if (paymentMethod.passcodeHash) {
      if (!passcode) {
        throw new BadRequestException(
          'Passcode is required to delete this payment method',
        );
      }
      await this.verifyPasscode(paymentMethod, passcode);
    }
    paymentMethod.status = PaymentMethodStatus.SUSPENDED;
    paymentMethod.accountNumber = null;
    paymentMethod.passcodeHash = null;
    paymentMethod.isPrimary = false;
    await this.paymentMethodRepository.save(paymentMethod);
    this.logger.log(`Payment method deleted: ${paymentMethodId}`);
  }
  async verifyPaymentMethod(
    paymentMethodId: string,
    status: PaymentMethodStatus,
    notes?: string,
  ): Promise<PaymentMethod> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId },
    });
    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }
    paymentMethod.status = status;
    paymentMethod.verificationNotes = notes || null;
    if (status === PaymentMethodStatus.VERIFIED) {
      paymentMethod.verifiedAt = new Date();
    }
    const updatedMethod =
      await this.paymentMethodRepository.save(paymentMethod);
    this.logger.log(`Payment method ${status}: ${paymentMethodId}`);
    return updatedMethod;
  }
  async recordPaymentMethodUsage(paymentMethodId: string): Promise<void> {
    await this.paymentMethodRepository.update(
      { id: paymentMethodId },
      { lastUsedAt: new Date() },
    );
  }
  async findByMemberId(memberId: string): Promise<PaymentMethod | null> {
    try {
      return await this.paymentMethodRepository.findOne({
        where: { memberId },
        order: { updatedAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to find payment method for member ${memberId}`,
        error,
      );
      throw error;
    }
  }
  async findById(id: string): Promise<PaymentMethod | null> {
    try {
      return await this.paymentMethodRepository.findOne({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Failed to find payment method ${id}`, error);
      throw error;
    }
  }
  private async verifyPasscode(
    paymentMethod: PaymentMethod,
    passcode: string,
  ): Promise<void> {
    if (
      !paymentMethod.passcodeHash ||
      paymentMethod.passcodeHash === null ||
      paymentMethod.passcodeHash === undefined
    ) {
      throw new BadRequestException(
        'Payment method does not have a passcode set. Please set a passcode first.',
      );
    }
    if (!passcode || passcode === null || passcode === undefined) {
      throw new BadRequestException('Passcode is required');
    }
    if (paymentMethod.isLocked) {
      throw new UnauthorizedException(
        `Payment method is locked until ${paymentMethod.lockedUntil?.toISOString()}`,
      );
    }
    const isValid = await PasswordService.verifyPassword(
      paymentMethod.passcodeHash,
      passcode,
    );
    if (!isValid) {
      paymentMethod.failedPasscodeAttempts += 1;
      if (paymentMethod.failedPasscodeAttempts >= this.maxFailedAttempts) {
        paymentMethod.lockedUntil = new Date(
          Date.now() + this.lockDurationMinutes * 60 * 1000,
        );
        this.logger.warn(
          `Payment method ${paymentMethod.id} locked due to failed passcode attempts`,
        );
      }
      await this.paymentMethodRepository.save(paymentMethod);
      throw new UnauthorizedException('Invalid passcode');
    }
    if (paymentMethod.failedPasscodeAttempts > 0) {
      paymentMethod.failedPasscodeAttempts = 0;
      paymentMethod.lockedUntil = null;
      await this.paymentMethodRepository.save(paymentMethod);
    }
  }
  private async validatePaymentMethodData(
    dto: CreatePaymentMethodDto,
  ): Promise<void> {
    if (dto.type && dto.type !== PaymentMethodType.BANK) {
      throw new BadRequestException(
        'Only BANK payment method type is supported',
      );
    }
    if (
      !dto.accountNumber ||
      !dto.accountName ||
      !dto.bankName ||
      !dto.country
    ) {
      throw new BadRequestException(
        'Bank payment method requires account number, account name, bank name, and country',
      );
    }
    if (dto.accountNumber.length > 17) {
      throw new BadRequestException('Account number cannot exceed 17 digits');
    }
  }
  private async unsetPrimaryMethods(
    tenantId: string,
    memberId: string,
    currency: string,
  ): Promise<void> {
    await this.paymentMethodRepository.update(
      {
        tenantId,
        memberId,
        currency: currency.toUpperCase(),
        isPrimary: true,
      },
      { isPrimary: false },
    );
  }
  private async trackPasscodeChange(
    paymentMethodId: string,
    memberId: string,
    reason: PasscodeChangeReason,
    notes?: string,
    ipAddress?: string,
    userAgent?: string,
    changedByAdminId?: string,
  ): Promise<void> {
    try {
      const passcodeHistory = this.passcodeHistoryRepository.create({
        paymentMethodId,
        memberId,
        reason,
        changedAt: new Date(),
        ipAddress,
        userAgent,
        changedByAdminId,
        notes,
        wasForced:
          reason === PasscodeChangeReason.SECURITY_RESET ||
          reason === PasscodeChangeReason.ADMIN_RESET,
      });
      await this.passcodeHistoryRepository.save(passcodeHistory);
      this.logger.log(
        `Passcode change tracked for payment method ${paymentMethodId}: ${reason}`,
      );
    } catch (error) {
      this.logger.error(
        `Error tracking passcode change for payment method ${paymentMethodId}:`,
        error,
      );
    }
  }
  async getPasscodeHistory(
    paymentMethodId: string,
    tenantId: string,
    memberId: string,
  ): Promise<PaymentMethodPasscodeHistory[]> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, tenantId, memberId },
    });
    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }
    return this.passcodeHistoryRepository.find({
      where: { paymentMethodId },
      order: { changedAt: 'DESC' },
      take: 10,
    });
  }
}
