import { SetMetadata } from '@nestjs/common';
export const AUTH_ONLY_KEY = 'authOnly';
export const AuthOnly = () => SetMetadata(AUTH_ONLY_KEY, true);
