import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class MemberPointAssignmentDto {
  @IsUUID('all')
  memberId: string;

  @IsInt()
  @Min(0)
  points: number;
}

export class AssignMemberPointsDto {
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  memberIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  points?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberPointAssignmentDto)
  assignments?: MemberPointAssignmentDto[];
}
