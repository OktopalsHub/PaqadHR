import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ENVIRONMENT } from 'src/common/config/env.config';
import type { JwtPayload } from 'src/common/interfaces';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';

interface JwtTokenPayload {
  sub: string;
  email: string;
  role: string;
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.access_token ?? null,
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

    if (payload.sid) {
      const session = await this.sessionRepository.findOne({
        where: { token: payload.sid, userId: payload.sub },
      });
      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session expired');
      }
    }

    return {
      principalId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
