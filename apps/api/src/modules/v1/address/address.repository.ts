import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { Address } from './entities/address.entity';

@Injectable()
export class AddressRepository extends Repository<Address> {
  constructor(@InjectRepository(Address) readonly addressRepository: Repository<Address>) {
    super(addressRepository.target, addressRepository.manager, addressRepository.queryRunner);
  }

  async findAddress(
    tenantMemberId: string,
    addressId: string,
    includeDeleted = false,
    relations: string[] = [],
  ): Promise<Address> {
    const address = await this.findOne({
      where: { id: addressId, tenantMemberId },
      withDeleted: includeDeleted,
      relations,
    });
    if (!address) {
      throw new NotFoundException('Address not found for this member');
    }
    return address;
  }

  async listAddresses(tenantMemberId: string): Promise<Address[]> {
    return this.find({ withDeleted: false, where: { tenantMemberId } });
  }
}
