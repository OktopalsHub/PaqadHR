import { Injectable } from '@nestjs/common';
import { ActivitiesService } from '../activities/services/activities.service';
import { AddressRepository } from './address.repository';
import type { CreateAddressDto } from './dto/create-address.dto';
import type { UpdateAddressDto } from './dto/update-address.dto';
import type { Address } from './entities/address.entity';

@Injectable()
export class AddressService {
  constructor(
    private readonly addressRepository: AddressRepository,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async createAddress(
    _tenantId: string,
    memberId: string,
    dto: CreateAddressDto,
    actorMemberId?: string,
  ) {
    const entity = this.addressRepository.create({
      ...dto,
      tenantMemberId: memberId,
    });
    const saved = await this.addressRepository.save(entity);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId: _tenantId,
          actorMemberId,
          action: 'address.created',
          resourceType: 'address',
          resourceId: saved.id,
          description: `Address created`,
          metadata: { city: dto.city, country: dto.country },
        })
        .catch(() => {});
    }

    return saved;
  }

  async listAddresses(_tenantId: string, memberId: string) {
    return this.addressRepository.listAddresses(memberId);
  }

  async getPrimaryAddress(memberId: string): Promise<Address | null> {
    const addresses = await this.addressRepository.listAddresses(memberId);
    return addresses[0] ?? null;
  }

  async upsertMemberAddress(
    memberId: string,
    dto: CreateAddressDto,
    tenantId?: string,
    actorMemberId?: string,
  ): Promise<Address> {
    const existing = await this.getPrimaryAddress(memberId);
    if (existing) {
      await this.addressRepository.update(existing.id, dto);
      return this.addressRepository.findOne({ where: { id: existing.id } }) as Promise<Address>;
    }
    return this.createAddress(tenantId ?? '', memberId, dto, actorMemberId);
  }

  async updateAddress(
    memberId: string,
    addressId: string,
    dto: UpdateAddressDto,
    tenantId?: string,
    actorMemberId?: string,
  ) {
    await this.getAddress(memberId, addressId);
    await this.addressRepository.update(addressId, dto);

    if (actorMemberId && tenantId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'address.updated',
          resourceType: 'address',
          resourceId: addressId,
          description: `Address updated`,
          metadata: { updatedFields: Object.keys(dto) },
        })
        .catch(() => {});
    }

    return this.addressRepository.findOne({ where: { id: addressId } });
  }

  async deleteAddress(
    memberId: string,
    addressId: string,
    tenantId?: string,
    actorMemberId?: string,
  ) {
    await this.getAddress(memberId, addressId);
    await this.addressRepository.delete(addressId);

    if (actorMemberId && tenantId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'address.deleted',
          resourceType: 'address',
          resourceId: addressId,
          description: `Address deleted`,
        })
        .catch(() => {});
    }
  }

  async getAddress(memberId: string, addressId: string) {
    return this.addressRepository.findAddress(memberId, addressId);
  }
}
