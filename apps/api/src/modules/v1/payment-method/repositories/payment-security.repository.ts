import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentSecurity } from "../entities/payment-security.entity";

@Injectable()
export class PaymentSecurityRepository extends Repository<PaymentSecurity> {
  constructor(
    @InjectRepository(PaymentSecurity)
    private readonly paymentSecurityRepository: Repository<PaymentSecurity>,
  ) {
    super(paymentSecurityRepository.target, paymentSecurityRepository.manager, paymentSecurityRepository.queryRunner);
  }
}
