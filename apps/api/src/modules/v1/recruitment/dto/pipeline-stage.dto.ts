import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { CandidateStatus } from 'src/common/enums';

export class CreatePipelineStageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsEnum(CandidateStatus)
  type: CandidateStatus;

  @IsOptional()
  @IsUUID()
  autoEmailTemplateId?: string | null;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a hex value like #3b82f6' })
  color?: string | null;

  @IsOptional()
  @IsUUID()
  jobOpeningId?: string;
}

export class UpdatePipelineStageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsEnum(CandidateStatus)
  type?: CandidateStatus;

  @IsOptional()
  @IsUUID()
  autoEmailTemplateId?: string | null;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a hex value like #3b82f6' })
  color?: string | null;
}

export class ReorderStagesDto {
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('all', { each: true })
  stageIds: string[];

  @IsOptional()
  @IsUUID()
  jobOpeningId?: string;
}

export class MoveCandidateStageDto {
  @IsUUID()
  stageId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** false skips the email entirely; omitted keeps the stage's automatic email. */
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  /** Sends this template instead of the stage's automatic one. */
  @IsOptional()
  @IsUUID()
  emailTemplateId?: string;
}
