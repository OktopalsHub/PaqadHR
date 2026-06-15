import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { AssetCondition, AssetStatus } from 'src/common/enums';
import { CreateAssetDto } from './create-asset.dto';

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
