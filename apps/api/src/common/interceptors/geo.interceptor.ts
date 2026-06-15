import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { GeoLocationHelper } from '../utils/geo-location.util';

@Injectable()
export class GeoInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
      socket: { remoteAddress?: string };
      countryCode?: string;
    }>();

    const ip = GeoLocationHelper.resolveClientIp(
      request.headers,
      request.socket?.remoteAddress,
      request.ip,
    );

    request.countryCode = await GeoLocationHelper.getCountryCode(ip);
    return next.handle();
  }
}
