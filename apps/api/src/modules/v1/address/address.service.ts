import { Injectable } from '@nestjs/common';
import { AddressRepository } from './address.repository';
import type { CreateAddressDto } from './dto/create-address.dto';
import type { UpdateAddressDto } from './dto/update-address.dto';
import type { Address } from './entities/address.entity';

@Injectable()
export class AddressService {
  constructor(private readonly addressRepository: AddressRepository) {}

  async createAddress(_tenantId: string, memberId: string, dto: CreateAddressDto) {
    const entity = this.addressRepository.create({
      ...dto,
      tenantMemberId: memberId,
    });
    return this.addressRepository.save(entity);
  }

  async listAddresses(_tenantId: string, memberId: string) {
    return this.addressRepository.listAddresses(memberId);
  }

  async getPrimaryAddress(memberId: string): Promise<Address | null> {
    const addresses = await this.addressRepository.listAddresses(memberId);
    return addresses[0] ?? null;
  }

  async upsertMemberAddress(memberId: string, dto: CreateAddressDto): Promise<Address> {
    const existing = await this.getPrimaryAddress(memberId);
    if (existing) {
      await this.addressRepository.update(existing.id, dto);
      return this.addressRepository.findOne({ where: { id: existing.id } }) as Promise<Address>;
    }
    return this.createAddress('', memberId, dto);
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
