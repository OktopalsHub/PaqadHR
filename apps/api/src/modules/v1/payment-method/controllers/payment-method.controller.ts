import { CreatePaymentMethodDto, UpdatePaymentMethodDto, PasscodeChangeDto } from '../dto/payment-method.dto';
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
import { PaymentMethodService } from '../services/payment-method.service';
import { TenantMember } from "../../tenant-members/entities/tenant-member.entity";
import { PaymentMethodStatus } from "../../../../common/enums/payment-method-status.enum";

@ApiTags('Payment Methods')
@Controller('tenants/:tenantId/payment-methods')
export class PaymentMethodController {
  private readonly logger = new Logger(PaymentMethodController.name);
  constructor(private readonly paymentMethodService: PaymentMethodService) {}
  @Post()
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Create bank payment method' })
  @ApiResponse({
    status: 201,
    description: 'Payment method created successfully',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['BANK'], default: 'BANK' },
        currency: { type: 'string', example: 'USD' },
        displayName: { type: 'string', example: 'My Primary Account' },
        bankName: { type: 'string', example: 'Chase Bank' },
        bankCode: { type: 'string', example: '021000021' },
        accountName: { type: 'string', example: 'John Doe' },
        accountNumber: {
          type: 'string',
          example: '1234567890',
          description: 'Max 17 digits (supports various countries)',
        },
        country: { type: 'string', example: 'US' },
        passcode: {
          type: 'string',
          example: '123456',
          description: 'uired exactly 6-digit passcode',
        },
        isPrimary: { type: 'boolean', example: false },
      },
      required: [
        'currency',
        'bankName',
        'accountName',
        'accountNumber',
        'country',
        'passcode',
      ],
    },
  })
  async createPaymentMethod(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreatePaymentMethodDto,
    @CurrentTenantMember() member: MemberContext
  ) {
    this.logger.log(
      `Creating payment method for member ${member.id} in tenant ${tenantId}`,
    );
    return this.paymentMethodService.createPaymentMethod(
      tenantId,
      member.id,
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
  @Put(':paymentMethodId')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Update bank payment method' })
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
        accountNumber: {
          type: 'string',
          description: 'Max 17 digits (supports various countries)',
        },
        country: { type: 'string' },
        currentPasscode: {
          type: 'string',
          description: 'uired current passcode',
        },
        newPasscode: {
          type: 'string',
          description: 'Optional new passcode (exactly 6 digits)',
        },
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
    this.logger.log(
      `Updating payment method ${paymentMethodId} for member ${member.id}`,
    );
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
        newPasscode: {
          type: 'string',
          description: 'New passcode (exactly 6 digits)',
        },
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
    this.logger.log(`Changing passcode for payment method ${paymentMethodId}`);
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
  @ApiResponse({
    status: 400,
    description: 'Passcode required if payment method has passcode set',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        passcode: {
          type: 'string',
          description:
            'Passcode for deletion (required if payment method has passcode)',
        },
      },
    },
  })
  async deletePaymentMethod(
    @Param('tenantId') tenantId: string,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() body: { passcode?: string },
    @CurrentTenantMember() member: MemberContext
  ) {
    this.logger.log(
      `Deleting payment method ${paymentMethodId} for member ${member.id}`,
    );
    await this.paymentMethodService.deletePaymentMethod(
      paymentMethodId,
      tenantId,
      member.id,
      body?.passcode,
    );
  }
  @Get('supported/currencies')
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'Get supported currencies for bank payment methods',
  })
  @ApiResponse({ status: 200, description: 'Supported currencies retrieved' })
  async getSupportedCurrencies() {
    return {
      fiat: ['USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS', 'ZAR'],
    };
  }
  @Get('member/:memberId')
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'Get payment method by member ID (Admin/System use)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method retrieved successfully',
  })
  async getPaymentMethodByMember(
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
  ) {
    this.logger.log(
      `Admin accessing payment method for member ${memberId} in tenant ${tenantId}`,
    );
    return this.paymentMethodService.findByMemberId(memberId);
  }
  @Get(':id')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Get payment method by ID (Admin/System use)' })
  @ApiResponse({
    status: 200,
    description: 'Payment method retrieved successfully',
  })
  async getPaymentMethod(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    this.logger.log(
      `Admin accessing payment method ${id} in tenant ${tenantId}`,
    );
    return this.paymentMethodService.findById(id);
  }
  @Post(':paymentMethodId/verify')
  @UseGuards(TenantGuard)
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
    @Param('tenantId') tenantId: string,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() body: { status: PaymentMethodStatus; notes?: string },
  ) {
    this.logger.log(
      `Admin verifying payment method ${paymentMethodId} with status ${body.status}`,
    );
    return this.paymentMethodService.verifyPaymentMethod(
      paymentMethodId,
      body.status,
      body.notes,
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
}
