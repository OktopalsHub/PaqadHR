import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';

@ApiTags('Addresses')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/members/:memberId/address')
export class MemberAddressController {
  constructor(private readonly addressService: AddressService) {}

  private assertCanAccess(member: MemberContext, memberId: string): void {
    const isAdmin =
      member.role === TenantMemberRole.ADMIN || member.role === TenantMemberRole.OWNER;
    if (!isAdmin && member.id !== memberId) {
      throw new ForbiddenException('You can only view your own address');
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getMemberAddress(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    this.assertCanAccess(member, memberId);
    return this.addressService.getPrimaryAddress(memberId);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async upsertMemberAddress(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: CreateAddressDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    this.assertCanAccess(member, memberId);
    return this.addressService.upsertMemberAddress(memberId, dto);
  }
}
