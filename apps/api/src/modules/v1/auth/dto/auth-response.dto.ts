import { ApiProperty } from '@nestjs/swagger';
import type { ITenantMemberResponseDto } from '../../../../common/interfaces/itenant-member-response-dto.interface';
import { TenantMemberMapper } from '../../tenant-members/dto/tenant-member-response.dto';
import type { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import type { User } from '../../users/entities/user.entity';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;
  @ApiProperty()
  refreshToken: string;
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
  @ApiProperty({ required: false })
  tenantMember?: ITenantMemberResponseDto;
  @ApiProperty()
  expiresIn: number;
  constructor(data: {
    accessToken: string;
    refreshToken: string;
    user: User;
    tenantMember?: TenantMember;
    expiresIn: number;
  }) {
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.user = UserResponseDto.toResponse(data.user);
    this.expiresIn = data.expiresIn;
    if (data.tenantMember) {
      this.tenantMember = TenantMemberMapper.toResponse(data.tenantMember);
    }
  }
}
