import { Body, Controller, Param, Post } from '@nestjs/common';
import { SetPasscodeDto, VerifyPasscodeDto } from '../dto/paymemt-security.dto';
import { PaymentSecurityService } from '../services/payment-security.service';

@Controller('payment-security')
export class PaymentSecurityController {
  constructor(private readonly paymentSecurityService: PaymentSecurityService) {}
  @Post(':memberId/set-passcode')
  async setPasscode(@Param('memberId') memberId: string, @Body() dto: SetPasscodeDto) {
    return this.paymentSecurityService.setPasscode(memberId, dto.passcode);
  }
  @Post(':memberId/verify-passcode')
  async verifyPasscode(@Param('memberId') memberId: string, @Body() dto: VerifyPasscodeDto) {
    const verified = await this.paymentSecurityService.verifyPasscode(memberId, dto.passcode);
    return { verified };
  }
}
