import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
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
}
