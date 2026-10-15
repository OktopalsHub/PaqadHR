import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ENVIRONMENT } from 'src/common/config/env.config';
import type { JwtPayload } from 'src/common/interfaces';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';
import { hashSessionToken } from '../utils/session-token.util';

interface JwtTokenPayload {
  sub: string;
  email: string;
  role: string;
  emailVerified: boolean;
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
    if (!payload?.sub || !payload?.email || !payload?.role || !payload.emailVerified) {
      throw new UnauthorizedException('Invalid token');
    }

    if (payload.sid) {
      const hashedToken = hashSessionToken(payload.sid);
      const session = await this.sessionRepository.findOne({
        where: [
          { token: hashedToken, userId: payload.sub },
          { token: payload.sid, userId: payload.sub },
        ],
      });
      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session expired');
      }

      if (session.token === payload.sid) {
        session.token = hashedToken;
        await this.sessionRepository.save(session);
      }
    }

    return {
      principalId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
