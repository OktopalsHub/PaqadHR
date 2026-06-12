import { CreateEmergencyContactDto } from "../../modules/v1/emergency-contact/dto/create-emergency-contact.dto";
import { EmergencyContact } from "../../modules/v1/emergency-contact/entities/emergency-contact.entity";
import { UpdateEmergencyContactDto } from "../../modules/v1/emergency-contact/dto/update-emergency-contact.dto";

export interface IEmergencyContactRepository {
    createEmergencyContact(createEmergencyContactDto: CreateEmergencyContactDto, tenantId: string, tenantMemberId: string): Promise<EmergencyContact>;
    listEmergencyContacts(tenantId: string, tenantMemberId?: string): Promise<EmergencyContact[]>;
    getEmergencyContact(id: string, tenantId: string): Promise<EmergencyContact | null>;
    updateEmergencyContact(id: string, updateEmergencyContactDto: UpdateEmergencyContactDto, tenantId: string): Promise<EmergencyContact>;
    deleteEmergencyContact(id: string, tenantId: string): Promise<void>;
    getPrimaryEmergencyContact(tenantMemberId: string, tenantId: string): Promise<EmergencyContact | null>;
    setAsPrimary(id: string, tenantId: string): Promise<EmergencyContact>;
}
