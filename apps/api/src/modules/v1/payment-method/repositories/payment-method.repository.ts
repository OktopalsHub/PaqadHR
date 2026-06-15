import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../entities/payment-method.entity';

@Injectable()
export class PaymentMethodRepository extends Repository<PaymentMethod> {
  constructor(
    @InjectRepository(PaymentMethod) readonly paymentMethodRepository: Repository<PaymentMethod>,
  ) {
    super(
      paymentMethodRepository.target,
      paymentMethodRepository.manager,
      paymentMethodRepository.queryRunner,
    );
  }
}
