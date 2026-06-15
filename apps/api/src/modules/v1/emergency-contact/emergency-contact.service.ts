import { Injectable } from '@nestjs/common';
import type { RelationshipType } from 'src/common/enums';
import type { CreateEmergencyContactDto } from './dto/create-emergency-contact.dto';
import type { UpdateEmergencyContactDto } from './dto/update-emergency-contact.dto';
import type { EmergencyContactRepository } from './emergency-contact.repository';
import type { EmergencyContact } from './entities/emergency-contact.entity';

@Injectable()
export class EmergencyContactService {
  constructor(private readonly emergencyContactRepository: EmergencyContactRepository) {}
  async createEmergencyContact(
    tenantId: string,
    tenantMemberId: string,
    createEmergencyContactDto: CreateEmergencyContactDto,
  ): Promise<EmergencyContact> {
    return this.emergencyContactRepository.createEmergencyContact(
      createEmergencyContactDto,
      tenantId,
      tenantMemberId,
    );
  }
  async listEmergencyContacts(
    tenantId: string,
    tenantMemberId?: string,
  ): Promise<EmergencyContact[]> {
    return this.emergencyContactRepository.listEmergencyContacts(tenantId, tenantMemberId);
  }
  async getEmergencyContact(id: string, tenantId: string): Promise<EmergencyContact> {
    return this.emergencyContactRepository.getEmergencyContact(id, tenantId);
  }
  async updateEmergencyContact(
    id: string,
    updateEmergencyContactDto: UpdateEmergencyContactDto,
    tenantId: string,
  ): Promise<EmergencyContact> {
    return this.emergencyContactRepository.updateEmergencyContact(
      id,
      updateEmergencyContactDto,
      tenantId,
    );
  }
  async deleteEmergencyContact(id: string, tenantId: string): Promise<void> {
    await this.emergencyContactRepository.deleteEmergencyContact(id, tenantId);
  }
  async getPrimaryEmergencyContact(
    tenantMemberId: string,
    tenantId: string,
  ): Promise<EmergencyContact | null> {
    return this.emergencyContactRepository.getPrimaryEmergencyContact(tenantMemberId, tenantId);
  }
  async setAsPrimary(id: string, tenantId: string): Promise<EmergencyContact> {
    return this.emergencyContactRepository.setAsPrimary(id, tenantId);
  }
  async getEmergencyContactsByRelationship(
    relationshipType: RelationshipType,
    tenantId: string,
    tenantMemberId?: string,
  ): Promise<EmergencyContact[]> {
    const contacts = await this.emergencyContactRepository.listEmergencyContacts(
      tenantId,
      tenantMemberId,
    );
    return contacts.filter((contact) => contact.relationship === relationshipType);
  }
}
