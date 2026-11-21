import { ApiProperty, PartialType } from '@nestjs/swagger';

import { IsIn, IsOptional } from 'class-validator';

import { INVITABLE_ROLES } from '../utils/invitation-role.util';
import { CreateInvitationDto } from './index';

export class UpdateInvitationDto extends PartialType(CreateInvitationDto) {
  @ApiProperty({
    description: 'Email address of the person to invite',
    example: 'user@example.com',
    required: false,
  })
  email?: string;
  @ApiProperty({
    description: 'Role for the invited user in the workspace',
    example: 'member',
    enum: INVITABLE_ROLES,
    required: false,
  })
  @IsOptional()
  @IsIn(INVITABLE_ROLES)
  role?: string;
  @ApiProperty({
    description: 'Expiration date for the invitation',
    example: '2024-01-15T00:00:00.000Z',
    required: false,
  })
  expiresAt?: Date;
}
