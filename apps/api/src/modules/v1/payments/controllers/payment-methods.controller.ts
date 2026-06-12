import { CreatePaymentMethodDto, UpdatePaymentMethodDto, PasscodeChangeDto } from '../../payment-method/dto/payment-method.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  UseGuards } from '@nestjs/common';
import { MemberContext } from 'src/common/interfaces';
import { CurrentTenantMember } from 'src/common/decorators';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from 'src/common/guards/tenant.guard';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { PaymentMethodService } from '../../payment-method/services/payment-method.service';
import { PaymentMethodStatus } from '../../../../common/enums/payment-method-status.enum';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';

@Controller('tenants/:tenantId/payment-methods')
@UseGuards(TenantGuard)
export class PaymentMethodsController {
  private readonly logger = new Logger(PaymentMethodsController.name);
  constructor(private readonly paymentMethodService: PaymentMethodService) {}
  @Post()
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Create payment method' })
  @ApiResponse({
    status: 201,
    description: 'Payment method created successfully',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['BANK', 'CRYPTO'] },
        currency: { type: 'string', example: 'USD' },
        displayName: { type: 'string', example: 'My Primary Account' },
        bankName: { type: 'string', example: 'Chase Bank' },
        bankCode: { type: 'string', example: '021000021' },
        accountName: { type: 'string', example: 'John Doe' },
        accountNumber: { type: 'string', example: '1234567890' },
        country: { type: 'string', example: 'US' },
        cryptoSymbol: { type: 'string', example: 'BTC' },
        cryptoNetwork: { type: 'string', example: 'BTC' },
        publicAddress: {
          type: 'string',
          example: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        },
        passcode: {
          type: 'string',
          example: '123456',
          description: 'uired 6-digit passcode',
        },
        isPrimary: { type: 'boolean', example: false },
      },
      required: ['type', 'currency', 'passcode'],
    },
  })
  async createPaymentMethod(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreatePaymentMethodDto,
    @CurrentTenantMember() member: MemberContext
  ) {
    return this.paymentMethodService.createPaymentMethod(
      tenantId,
      member.id,
      dto,
    );
  }
  @Get()
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Get payment methods' })
  @ApiResponse({
    status: 200,
    description: 'Payment methods retrieved successfully',
  })
  async getPaymentMethods(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
    @Query('currency') currency?: string,
  ) {
    return this.paymentMethodService.getPaymentMethods(
      tenantId,
      member.id,
      currency,
    );
  }
  @Get('primary/:currency')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Get primary payment method for currency' })
  @ApiResponse({ status: 200, description: 'Primary payment method retrieved' })
  async getPrimaryPaymentMethod(
    @Param('tenantId') tenantId: string,
    @Param('currency') currency: string,
    @CurrentTenantMember() member: MemberContext
  ) {
    return this.paymentMethodService.getPrimaryPaymentMethod(
      tenantId,
      member.id,
      currency,
    );
  }
  @Put(':paymentMethodId')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Update payment method' })
  @ApiResponse({
    status: 200,
    description: 'Payment method updated successfully',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        displayName: { type: 'string' },
        bankName: { type: 'string' },
        bankCode: { type: 'string' },
        accountName: { type: 'string' },
        accountNumber: { type: 'string' },
        country: { type: 'string' },
        cryptoSymbol: { type: 'string' },
        cryptoNetwork: { type: 'string' },
        publicAddress: { type: 'string' },
        currentPasscode: {
          type: 'string',
          description: 'uired current passcode',
        },
        newPasscode: { type: 'string', description: 'Optional new passcode' },
        isPrimary: { type: 'boolean' },
      },
      required: ['currentPasscode'],
    },
  })
  async updatePaymentMethod(
    @Param('tenantId') tenantId: string,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() dto: UpdatePaymentMethodDto,
    @CurrentTenantMember() member: MemberContext
  ) {
    return this.paymentMethodService.updatePaymentMethod(
      paymentMethodId,
      tenantId,
      member.id,
      dto,
    );
  }
  @Put(':paymentMethodId/passcode')
  @UseGuards(TenantMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change payment method passcode' })
  @ApiResponse({ status: 204, description: 'Passcode changed successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        currentPasscode: { type: 'string', description: 'Current passcode' },
        newPasscode: { type: 'string', description: 'New passcode (6 digits)' },
      },
      required: ['currentPasscode', 'newPasscode'],
    },
  })
  async changePasscode(
    @Param('tenantId') tenantId: string,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() dto: PasscodeChangeDto,
    @CurrentTenantMember() member: MemberContext
  ) {
    await this.paymentMethodService.changePasscode(
      paymentMethodId,
      tenantId,
      member.id,
      dto,
    );
  }
  @Delete(':paymentMethodId')
  @UseGuards(TenantMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete payment method' })
  @ApiResponse({
    status: 204,
    description: 'Payment method deleted successfully',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        passcode: {
          type: 'string',
          description: 'uired passcode for deletion',
        },
      },
      required: ['passcode'],
    },
  })
  async deletePaymentMethod(
    @Param('tenantId') tenantId: string,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() body: { passcode: string },
    @CurrentTenantMember() member: MemberContext
  ) {
    await this.paymentMethodService.deletePaymentMethod(
      paymentMethodId,
      tenantId,
      member.id,
      body.passcode,
    );
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
    @CurrentTenantMember() member: MemberContext
  ) {
    return this.paymentMethodService.getPasscodeHistory(
      paymentMethodId,
      tenantId,
      member.id,
    );
  }
  @Post(':paymentMethodId/verify')
  @ApiOperation({ summary: 'Manually verify payment method (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Payment method verification updated',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['VERIFIED', 'REJECTED', 'SUSPENDED'] },
        notes: { type: 'string', description: 'Verification notes' },
      },
      required: ['status'],
    },
  })
  async verifyPaymentMethod(
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() body: { status: string; notes?: string },
  ) {
    return this.paymentMethodService.verifyPaymentMethod(
      paymentMethodId,
      body.status as PaymentMethodStatus,
      body.notes,
    );
  }
  @Get('member/:memberId')
  @ApiOperation({ summary: 'Get payment method by member ID (System use)' })
  @ApiResponse({ status: 200, description: 'Payment method retrieved' })
  async getPaymentMethodByMember(@Param('memberId') memberId: string) {
    return this.paymentMethodService.findByMemberId(memberId);
  }
  @Get('details/:id')
  @ApiOperation({ summary: 'Get payment method details by ID (System use)' })
  @ApiResponse({ status: 200, description: 'Payment method details retrieved' })
  async getPaymentMethodDetails(@Param('id') id: string) {
    return this.paymentMethodService.findById(id);
  }
}
