import { PartialType } from '@nestjs/swagger';
import { CreateShoutoutCategoryDto } from './create-shoutout-category.dto';

export class UpdateShoutoutCategoryDto extends PartialType(
  CreateShoutoutCategoryDto,
) {}
