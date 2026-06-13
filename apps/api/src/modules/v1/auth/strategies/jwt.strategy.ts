import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ENVIRONMENT } from 'src/common/config/env.config';
import { JwtPayload } from 'src/common/interfaces';

interface JwtTokenPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['access_token'] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: ENVIRONMENT.JWT.ACCESS_SECRET,
    });
  }
  async validate(payload: JwtTokenPayload): Promise<JwtPayload> {
    if (!payload?.sub || !payload?.email || !payload?.role) {
      throw new UnauthorizedException('Invalid token');
    }
    return {
      principalId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
