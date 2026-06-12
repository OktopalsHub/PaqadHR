import { SetMetadata } from '@nestjs/common';
export const IS_MEMBER_OPTIONAL_KEY = 'isMemberOptional';
export const SkipMember = () => SetMetadata(IS_MEMBER_OPTIONAL_KEY, true);
