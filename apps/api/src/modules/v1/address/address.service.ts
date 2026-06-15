import { Injectable } from '@nestjs/common';
import type { AddressRepository } from './address.repository';
import type { CreateAddressDto } from './dto/create-address.dto';
import type { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressService {
  constructor(private readonly addressRepository: AddressRepository) {}

  async createAddress(_tenantId: string, memberId: string, dto: CreateAddressDto) {
    return this.addressRepository.create({
      ...dto,
      tenantMemberId: memberId,
    });
  }

  async listAddresses(_tenantId: string, memberId: string) {
    return this.addressRepository.listAddresses(memberId);
  }

  async updateAddress(memberId: string, addressId: string, dto: UpdateAddressDto) {
    await this.getAddress(memberId, addressId);
    await this.addressRepository.update(addressId, dto);
    return this.addressRepository.findOne({ where: { id: addressId } });
  }

  async deleteAddress(memberId: string, addressId: string) {
    await this.getAddress(memberId, addressId);
    return this.addressRepository.delete(addressId);
  }

  async getAddress(memberId: string, addressId: string) {
    return this.addressRepository.findAddress(memberId, addressId);
  }
}
