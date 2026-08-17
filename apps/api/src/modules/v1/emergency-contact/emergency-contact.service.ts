import { Injectable } from '@nestjs/common';
import type { RelationshipType } from 'src/common/enums';
import { ActivitiesService } from '../activities/services/activities.service';
import type { CreateEmergencyContactDto } from './dto/create-emergency-contact.dto';
import type { UpdateEmergencyContactDto } from './dto/update-emergency-contact.dto';
import { EmergencyContactRepository } from './emergency-contact.repository';
import type { EmergencyContact } from './entities/emergency-contact.entity';

@Injectable()
export class EmergencyContactService {
  constructor(
    private readonly emergencyContactRepository: EmergencyContactRepository,
    private readonly activitiesService: ActivitiesService,
  ) {}
  async createEmergencyContact(
    tenantId: string,
    tenantMemberId: string,
    createEmergencyContactDto: CreateEmergencyContactDto,
    actorMemberId?: string,
  ): Promise<EmergencyContact> {
    const contact = await this.emergencyContactRepository.createEmergencyContact(
      createEmergencyContactDto,
      tenantId,
      tenantMemberId,
    );

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'emergency_contact.created',
          resourceType: 'emergency_contact',
          resourceId: contact.id,
          description: `Emergency contact created`,
          metadata: {
            fullName: createEmergencyContactDto.fullName,
            relationship: createEmergencyContactDto.relationship,
          },
        })
        .catch(() => {});
    }

    return contact;
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
    actorMemberId?: string,
  ): Promise<EmergencyContact> {
    const updated = await this.emergencyContactRepository.updateEmergencyContact(
      id,
      updateEmergencyContactDto,
      tenantId,
    );

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'emergency_contact.updated',
          resourceType: 'emergency_contact',
          resourceId: id,
          description: `Emergency contact updated`,
          metadata: { updatedFields: Object.keys(updateEmergencyContactDto) },
        })
        .catch(() => {});
    }

    return updated;
  }
  async deleteEmergencyContact(
    id: string,
    tenantId: string,
    actorMemberId?: string,
  ): Promise<void> {
    await this.emergencyContactRepository.deleteEmergencyContact(id, tenantId);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'emergency_contact.deleted',
          resourceType: 'emergency_contact',
          resourceId: id,
          description: `Emergency contact deleted`,
        })
        .catch(() => {});
    }
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
