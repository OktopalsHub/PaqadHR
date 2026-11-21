import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const ASSIGN_POINTS_MAX_PER_MEMBER = 1_000_000;
export const ASSIGN_POINTS_MAX_MEMBERS = 1000;

export class MemberPointAssignmentDto {
  @IsUUID('all')
  memberId: string;

  @IsInt()
  @Min(0)
  @Max(ASSIGN_POINTS_MAX_PER_MEMBER)
  points: number;
}

export class AssignMemberPointsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ASSIGN_POINTS_MAX_MEMBERS)
  @IsUUID('all', { each: true })
  memberIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(ASSIGN_POINTS_MAX_PER_MEMBER)
  points?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ASSIGN_POINTS_MAX_MEMBERS)
  @ValidateNested({ each: true })
  @Type(() => MemberPointAssignmentDto)
  assignments?: MemberPointAssignmentDto[];
}
