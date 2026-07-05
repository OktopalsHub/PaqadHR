import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ShoutoutRecipientInputDto {
  @ApiProperty({ description: 'Tenant member id of the recipient' })
  @IsUUID('4')
  recipientId: string;

  @ApiProperty({ example: 10, description: 'Points awarded to this recipient' })
  @IsInt()
  @Min(1)
  points: number;
}

export class CreateShoutoutDto {
  @ApiProperty({ type: [ShoutoutRecipientInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShoutoutRecipientInputDto)
  recipients: ShoutoutRecipientInputDto[];

  @ApiProperty({ example: 'Great work on the launch!' })
  @IsString()
  @MaxLength(2000)
  message: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];
}
