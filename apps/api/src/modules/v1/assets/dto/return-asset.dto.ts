import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { AssetCondition } from 'src/common/enums';
export class ReturnAssetDto {
  @ApiProperty({
    description: 'return condition',
    enum: AssetCondition,
  })
  @IsEnum(AssetCondition)
  returnCondition: AssetCondition;
  @IsOptional()
  @ApiProperty({
    description: 'return notes',
    required: false,
  })
  @IsString()
  returnNotes?: string;
}
