import { Injectable, NotFoundException } from '@nestjs/common';

import { ActivitiesService } from '../activities/services/activities.service';
import { TenantMembersService } from '../tenant-members/tenant-members.service';
import { AddressRepository } from './address.repository';
import type { CreateAddressDto } from './dto/create-address.dto';
import type { UpdateAddressDto } from './dto/update-address.dto';
import type { Address } from './entities/address.entity';

@Injectable()
export class AddressService {
  constructor(
    private readonly addressRepository: AddressRepository,
    private readonly activitiesService: ActivitiesService,
    private readonly tenantMembersService: TenantMembersService,
  ) {}

  private async assertMemberInTenant(tenantId: string, memberId: string): Promise<void> {
    const members = await this.tenantMembersService.getTenantMembersByIds(tenantId, [memberId]);
    if (members.length === 0) {
      throw new NotFoundException('Member not found');
    }
  }

  async createAddress(
    tenantId: string,
    memberId: string,
    dto: CreateAddressDto,
    actorMemberId?: string,
  ) {
    await this.assertMemberInTenant(tenantId, memberId);
    const entity = this.addressRepository.create({
      ...dto,
      tenantMemberId: memberId,
    });
    const saved = await this.addressRepository.save(entity);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
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

  async listAddresses(tenantId: string, memberId: string) {
    await this.assertMemberInTenant(tenantId, memberId);
    return this.addressRepository.listAddresses(memberId);
  }

  async getPrimaryAddress(tenantId: string, memberId: string): Promise<Address | null> {
    const addresses = await this.listAddresses(tenantId, memberId);
    return addresses[0] ?? null;
  }

  async upsertMemberAddress(
    tenantId: string,
    memberId: string,
    dto: CreateAddressDto,
    actorMemberId?: string,
  ): Promise<Address> {
    const existing = await this.getPrimaryAddress(tenantId, memberId);
    if (existing) {
      await this.addressRepository.update(existing.id, dto);
      return this.addressRepository.findOne({ where: { id: existing.id } }) as Promise<Address>;
    }
    return this.createAddress(tenantId, memberId, dto, actorMemberId);
  }

  async updateAddress(
    tenantId: string,
    memberId: string,
    addressId: string,
    dto: UpdateAddressDto,
    actorMemberId?: string,
  ) {
    await this.getAddress(tenantId, memberId, addressId);
    await this.addressRepository.update(addressId, dto);

    if (actorMemberId) {
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
    tenantId: string,
    memberId: string,
    addressId: string,
    actorMemberId?: string,
  ) {
    await this.getAddress(tenantId, memberId, addressId);
    await this.addressRepository.delete(addressId);

    if (actorMemberId) {
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

  async getAddress(tenantId: string, memberId: string, addressId: string) {
    await this.assertMemberInTenant(tenantId, memberId);
    return this.addressRepository.findAddress(memberId, addressId);
  }
}
