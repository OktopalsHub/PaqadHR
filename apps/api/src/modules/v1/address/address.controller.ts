import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('Addresses')
@Controller('tenants/:tenantId/address')
@UseGuards(TenantMemberGuard)
@RequireFeatures(FeatureAccess.EMPLOYEE_SELF_SERVICE)
export class AddressController {
  constructor(private readonly addressService: AddressService) {}
  @Post()
  async createAddress(
    @Param('tenantId') tenantId: string,
    @Body() createAddressDto: CreateAddressDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.addressService.createAddress(tenantId, member.id, createAddressDto);
  }
  @Get()
  async listAddresses(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.addressService.listAddresses(tenantId, member.id);
  }
  @Patch(':addressId')
  async updateAddress(
    @Param('tenantId') tenantId: string,
    @Param('addressId') addressId: string,
    @Body() updateAddressDto: UpdateAddressDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.addressService.updateAddress(member.id, addressId, updateAddressDto);
  }
  @Delete(':addressId')
  async deleteAddress(
    @Param('tenantId') tenantId: string,
    @Param('addressId') addressId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.addressService.deleteAddress(member.id, addressId);
  }
}
