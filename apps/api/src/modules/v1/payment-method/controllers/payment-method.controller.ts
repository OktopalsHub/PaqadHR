import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SUPPORTED_CRYPTO_CURRENCIES } from 'src/common/constants/crypto-currencies.constant';
import {
  CurrentTenantMember,
  CurrentUser,
  RateLimit,
  RateLimitPresets,
} from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { TenantConfigService } from '../../tenant-settings/services/tenant-config.service';
import {
  CreatePaymentMethodDto,
  PasscodeChangeDto,
  SubmitForVerificationDto,
  UpdatePaymentMethodDto,
  VerifyPaymentMethodDto,
} from '../dto/payment-method.dto';
import { PaymentMethodService } from '../services/payment-method.service';

@ApiTags('Payment Methods')
@Controller('tenants/:tenantId/payment-methods')
export class PaymentMethodController {
  constructor(
    private readonly paymentMethodService: PaymentMethodService,
    private readonly tenantConfigService: TenantConfigService,
  ) {}
  @Post()
  @UseGuards(TenantMemberGuard)
  @RateLimit(RateLimitPresets.SENSITIVE)
  @ApiOperation({ summary: 'Create bank payment method' })
  @ApiResponse({
    status: 201,
    description: 'Payment method created successfully',
  })
  async createPaymentMethod(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreatePaymentMethodDto,
    @CurrentTenantMember() member: MemberContext,
    @CurrentUser() request: { auth?: { principalId?: string } },
  ) {
    return this.paymentMethodService.createPaymentMethod(
      tenantId,
      member.id,
      request.auth?.principalId ?? '',
      dto,
    );
  }
  @Get()
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Get payment methods for current member' })
  @ApiResponse({
    status: 200,
    description: 'Payment methods retrieved successfully',
  })
  async getPaymentMethods(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
    @Query('currency') currency?: string,
    @Query('isPrimary') isPrimary?: string,
  ) {
    const methods = await this.paymentMethodService.getPaymentMethods(
      tenantId,
      member.id,
      currency,
    );
    if (isPrimary === 'true') {
      return methods.filter((method) => method.isPrimary);
    }
    return methods;
  }
  @Get('banks')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'List Nigerian banks for account lookup (NGN)' })
  async listBanks() {
    return { banks: await this.paymentMethodService.listNigerianBanks() };
  }
  @Post('bank-lookup')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Verify Nigerian bank account and resolve account name' })
  async bankLookup(@Body() body: { accountNumber: string; bankCode: string; bankName?: string }) {
    return this.paymentMethodService.lookupNigerianBankAccount(
      body.accountNumber,
      body.bankCode,
      body.bankName,
    );
  }
  @Put(':paymentMethodId')
  @UseGuards(TenantMemberGuard)
  @RateLimit(RateLimitPresets.SENSITIVE)
  @ApiOperation({ summary: 'Update bank payment method' })
  @ApiResponse({
    status: 200,
    description: 'Payment method updated successfully',
  })
  async updatePaymentMethod(
    @Param('tenantId') tenantId: string,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() dto: UpdatePaymentMethodDto,
    @CurrentTenantMember() member: MemberContext,
    @CurrentUser() request: { auth?: { principalId?: string } },
  ) {
    return this.paymentMethodService.updatePaymentMethod(
      paymentMethodId,
      tenantId,
      member.id,
      request.auth?.principalId ?? '',
      dto,
    );
  }
  @Put(':paymentMethodId/passcode')
  @UseGuards(TenantMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit(RateLimitPresets.SENSITIVE)
  @ApiOperation({ summary: 'Change member payment passcode (legacy path)' })
  @ApiResponse({ status: 204, description: 'Passcode changed successfully' })
  async changePasscode(
    @Param('tenantId') tenantId: string,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() dto: PasscodeChangeDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    await this.paymentMethodService.changePasscode(paymentMethodId, tenantId, member.id, dto);
  }
  @Delete(':paymentMethodId')
  @UseGuards(TenantMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit(RateLimitPresets.SENSITIVE)
  @ApiOperation({ summary: 'Delete payment method' })
  @ApiResponse({
    status: 204,
    description: 'Payment method deleted successfully',
  })
  async deletePaymentMethod(
    @Param('tenantId') tenantId: string,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() body: { passcode?: string },
    @CurrentTenantMember() member: MemberContext,
  ) {
    await this.paymentMethodService.deletePaymentMethod(
      paymentMethodId,
      tenantId,
      member.id,
      body?.passcode,
    );
  }
  @Get('supported/currencies')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({
    summary: 'Get supported currencies for bank payment methods',
  })
  @ApiResponse({ status: 200, description: 'Supported currencies retrieved' })
  async getSupportedCurrencies(@Param('tenantId') tenantId: string) {
    const fiat = await this.paymentMethodService.getAllowedCurrencies(tenantId);
    const cryptoEnabled = await this.tenantConfigService.isCryptoEnabled(tenantId);
    return { fiat, crypto: cryptoEnabled ? [...SUPPORTED_CRYPTO_CURRENCIES] : [] };
  }
  @Get('member/:memberId')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({
    summary: 'Get payment method by member ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method retrieved successfully',
  })
  async getPaymentMethodByMember(
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.paymentMethodService.findByMemberIdForRequester(
      tenantId,
      memberId,
      member.id,
      member.role,
    );
  }
  @Get('admin/pending')
  @UseGuards(TenantMemberGuard, TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @ApiOperation({ summary: 'List payment methods awaiting admin verification' })
  async listPendingVerification(@Param('tenantId') tenantId: string) {
    return this.paymentMethodService.listPendingVerificationForTenant(tenantId);
  }

  @Get(':id')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Get payment method by ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment method retrieved successfully',
  })
  async getPaymentMethod(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.paymentMethodService.findByIdForMember(tenantId, id, member.id, member.role);
  }

  @Post(':paymentMethodId/submit-for-verification')
  @UseGuards(TenantMemberGuard)
  @RateLimit(RateLimitPresets.SENSITIVE)
  @ApiOperation({ summary: 'Submit payment method for admin verification' })
  async submitForVerification(
    @Param('tenantId') tenantId: string,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() dto: SubmitForVerificationDto,
    @CurrentTenantMember() member: MemberContext,
    @CurrentUser() request: { auth?: { principalId?: string } },
  ) {
    return this.paymentMethodService.submitForVerification(
      paymentMethodId,
      tenantId,
      member.id,
      request.auth?.principalId ?? '',
      dto,
    );
  }

  @Post(':paymentMethodId/verify')
  @UseGuards(TenantMemberGuard, TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @ApiOperation({ summary: 'Manually verify payment method (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Payment method verification updated',
  })
  @ApiBody({ type: VerifyPaymentMethodDto })
  async verifyPaymentMethod(
    @Param('tenantId') tenantId: string,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() body: VerifyPaymentMethodDto,
  ) {
    return this.paymentMethodService.verifyPaymentMethod(paymentMethodId, tenantId, body);
  }
  @Get(':paymentMethodId/passcode-history')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Get passcode change history' })
  @ApiResponse({
    status: 200,
    description: 'Passcode change history retrieved',
  })
  async getPasscodeHistory(
    @Param('tenantId') tenantId: string,
    @Param('paymentMethodId') paymentMethodId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.paymentMethodService.getPasscodeHistory(paymentMethodId, tenantId, member.id);
  }
}
