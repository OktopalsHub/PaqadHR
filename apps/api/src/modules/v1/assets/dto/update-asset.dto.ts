import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { AssetStatus, AssetCondition } from 'src/common/enums';
import { CreateAssetDto } from "./create-asset.dto";

export class UpdateAssetDto extends PartialType(CreateAssetDto) {
  @IsOptional()
  @ApiProperty({
    description: 'status',
    required: false,
    enum: AssetStatus,
  })
  @IsEnum(AssetStatus)
  status?: AssetStatus;
  @IsOptional()
  @ApiProperty({
    description: 'condition',
    required: false,
    enum: AssetCondition,
  })
  @IsEnum(AssetCondition)
  condition?: AssetCondition;
}
