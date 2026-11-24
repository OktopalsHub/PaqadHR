import { ClassSerializerInterceptor } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

export const SERIALIZER_PROVIDER = {
  provide: APP_INTERCEPTOR,
  useClass: ClassSerializerInterceptor,
};
