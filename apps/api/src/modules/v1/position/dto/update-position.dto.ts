import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { CreatePositionDto } from "./create-position.dto";

export class UpdatePositionDto extends PartialType(CreatePositionDto) {}
