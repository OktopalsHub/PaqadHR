import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindOptionsWhere, Repository } from 'typeorm';
import type { IEmergencyContactRepository } from '../../../common/interfaces/iemergency-contact-repository.interface';
import type { CreateEmergencyContactDto } from './dto/create-emergency-contact.dto';
import type { UpdateEmergencyContactDto } from './dto/update-emergency-contact.dto';
import { EmergencyContact } from './entities/emergency-contact.entity';

@Injectable()
export class EmergencyContactRepository
  extends Repository<EmergencyContact>
  implements IEmergencyContactRepository
{
  constructor(
    @InjectRepository(EmergencyContact)
    repository: Repository<EmergencyContact>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }
  async createEmergencyContact(
    createEmergencyContactDto: CreateEmergencyContactDto,
    tenantId: string,
    tenantMemberId: string,
  ): Promise<EmergencyContact> {
    if (createEmergencyContactDto.isPrimary) {
      await this.unsetExistingPrimary(tenantMemberId, tenantId);
    }
    return this.create({
      ...createEmergencyContactDto,
      tenantId,
      tenantMemberId,
    });
  }
  async listEmergencyContacts(
    tenantId: string,
    tenantMemberId?: string,
  ): Promise<EmergencyContact[]> {
    const where: FindOptionsWhere<EmergencyContact> = { tenantId };
    if (tenantMemberId) {
      where.tenantMemberId = tenantMemberId;
    }
    return this.find({ withDeleted: false, where: where });
  }
  async getEmergencyContact(id: string, tenantId: string): Promise<EmergencyContact> {
    const contact = await this.findOne({
      where: { id, tenantId } as FindOptionsWhere<EmergencyContact>,
      withDeleted: false,
    });
    if (!contact) {
      throw new NotFoundException(`Emergency contact with ID "${id}" not found`);
    }
    return contact;
  }
  async updateEmergencyContact(
    id: string,
    updateEmergencyContactDto: UpdateEmergencyContactDto,
    tenantId: string,
  ): Promise<EmergencyContact> {
    if (updateEmergencyContactDto.isPrimary) {
      const contact = await this.getEmergencyContact(id, tenantId);
      if (contact) {
        await this.unsetExistingPrimary(contact.tenantMemberId, tenantId);
      }
    }
    await this.update(id, updateEmergencyContactDto);
    const updatedContact = await this.getEmergencyContact(id, tenantId);
    if (!updatedContact) {
      throw new NotFoundException(`Emergency contact with ID "${id}" not found`);
    }
    return updatedContact;
  }
  async deleteEmergencyContact(id: string, tenantId: string): Promise<void> {
    await this.getEmergencyContact(id, tenantId);
    const result = await this.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Emergency contact with ID "${id}" not found`);
    }
  }
  async getPrimaryEmergencyContact(
    tenantMemberId: string,
    tenantId: string,
  ): Promise<EmergencyContact | null> {
    return this.findOne({
      where: {
        tenantMemberId,
        tenantId,
        isPrimary: true,
      } as FindOptionsWhere<EmergencyContact>,
      withDeleted: false,
    });
  }
  async setAsPrimary(id: string, tenantId: string): Promise<EmergencyContact> {
    const contact = await this.getEmergencyContact(id, tenantId);
    await this.unsetExistingPrimary(contact.tenantMemberId, tenantId);
    await this.update(id, { isPrimary: true });
    const updatedContact = await this.getEmergencyContact(id, tenantId);
    if (!updatedContact) {
      throw new NotFoundException(`Emergency contact with ID "${id}" not found after update`);
    }
    return updatedContact;
  }
  private async unsetExistingPrimary(tenantMemberId: string, tenantId: string): Promise<void> {
    const primaryContacts = await this.find({
      withDeleted: true,
      where: {
        tenantMemberId,
        tenantId,
        isPrimary: true,
      } as FindOptionsWhere<EmergencyContact>,
    });
    for (const contact of primaryContacts) {
      await this.update(contact.id, { isPrimary: false });
    }
  }
}
