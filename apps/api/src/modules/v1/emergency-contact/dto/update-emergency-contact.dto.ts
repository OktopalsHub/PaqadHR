import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { CreateEmergencyContactDto } from "./create-emergency-contact.dto";

export class UpdateEmergencyContactDto extends PartialType(
  CreateEmergencyContactDto,
) {}
