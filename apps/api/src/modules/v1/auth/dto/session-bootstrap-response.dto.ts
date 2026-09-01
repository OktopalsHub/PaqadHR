import { ApiProperty } from '@nestjs/swagger';

export class SessionUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  role: string;
}

export class SessionWorkspaceMemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  isActive: boolean;
}

export class SessionWorkspaceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false })
  logoUrl?: string;

  @ApiProperty({ required: false })
  timezone?: string;

  @ApiProperty({ required: false })
  preferredCurrency?: string;

  @ApiProperty({ required: false })
  countryCode?: string;

  @ApiProperty({ type: SessionWorkspaceMemberDto })
  member: SessionWorkspaceMemberDto;

  @ApiProperty()
  entitled: boolean;

  @ApiProperty()
  needsPayment: boolean;

  @ApiProperty({ nullable: true })
  plan: string | null;
}

export class SessionBootstrapResponseDto {
  @ApiProperty({ type: SessionUserDto })
  user: SessionUserDto;

  @ApiProperty()
  paymentsEnabled: boolean;

  @ApiProperty()
  featureGatingEnabled: boolean;

  @ApiProperty({ type: [SessionWorkspaceDto] })
  workspaces: SessionWorkspaceDto[];
}
