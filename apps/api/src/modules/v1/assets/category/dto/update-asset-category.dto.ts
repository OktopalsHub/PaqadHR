import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAssetCategoryDto } from './create-asset-category.dto';

export class UpdateAssetCategoryDto extends PartialType(CreateAssetCategoryDto) {
  @IsOptional()
  @ApiProperty({
    description: 'is active',
    required: false,
    example: true,
  })
  @IsBoolean()
  isActive?: boolean;
}
