import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ENVIRONMENT } from 'src/common/config/env.config';
import { parseDurationToMs } from 'src/common/config/parse-duration.util';
import { MoreThan, Repository } from 'typeorm';
import type { User } from '../../users/entities/user.entity';
import { UserRepository } from '../../users/repositories/users.repository';
import { Session } from '../entities/session.entity';
import { hashSessionToken } from '../utils/session-token.util';

const DEFAULT_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_ACCESS_MS = 15 * 60 * 1000;

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly userRepository: UserRepository,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly jwtService: JwtService,
  ) {}

  generateTokens(user: User, sessionToken?: string, _rememberMe = true) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      sid: sessionToken,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ENVIRONMENT.JWT.ACCESS_EXPIRES_IN as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: ENVIRONMENT.JWT.REFRESH_SECRET,
      expiresIn: ENVIRONMENT.JWT.REFRESH_EXPIRES_IN as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
    return { accessToken, refreshToken };
  }

  /** Session row lifetime from env (validated at boot; session ≥ refresh). */
  static getSessionDurationMs(): number {
    return parseDurationToMs(ENVIRONMENT.JWT.SESSION_EXPIRES_IN) ?? DEFAULT_SESSION_MS;
  }

  /** Refresh cookie lifetime — keep aligned with REFRESH_EXPIRES_IN. */
  static getRefreshDurationMs(): number {
    return parseDurationToMs(ENVIRONMENT.JWT.REFRESH_EXPIRES_IN) ?? DEFAULT_SESSION_MS;
  }

  /** Access cookie lifetime — keep aligned with ACCESS_EXPIRES_IN. */
  static getAccessDurationMs(): number {
    const raw = ENVIRONMENT.JWT.ACCESS_EXPIRES_IN;
    if (typeof raw === 'number') {
      // Numeric ACCESS_EXPIRES_IN is seconds after env.config normalization.
      return raw * 1000;
    }
    return parseDurationToMs(raw) ?? DEFAULT_ACCESS_MS;
  }

  async createSession(
    userId: string,
    ipAddress?: string | null,
    userAgent?: string | null,
    _rememberMe = true,
  ): Promise<Session> {
    const sessionToken = randomUUID();
    const durationMs = AuthSessionService.getSessionDurationMs();
    const expiresAt = new Date(Date.now() + durationMs);
    const session = this.sessionRepository.create({
      userId,
      token: hashSessionToken(sessionToken),
      expiresAt,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });
    return this.sessionRepository.save(session);
  }

  async refreshToken(refreshToken: string) {
    let payload: { sub: string; sid?: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: ENVIRONMENT.JWT.REFRESH_SECRET,
      }) as { sub: string; sid?: string };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = await this.userRepository.findUser(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.emailVerified) {
      throw new UnauthorizedException('Verify your email address before signing in');
    }
    if (!payload.sid) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const currentToken = hashSessionToken(payload.sid);
    const newSessionToken = randomUUID();
    const rotated = await this.sessionRepository.manager.transaction(async (manager) => {
      const session = await manager.findOne(Session, {
        where: [
          { token: currentToken, userId: user.id },
          { token: payload.sid, userId: user.id },
        ],
        lock: { mode: 'pessimistic_write' },
      });

      if (!session || session.expiresAt <= new Date()) {
        return false;
      }

      session.token = hashSessionToken(newSessionToken);
      session.expiresAt = new Date(Date.now() + AuthSessionService.getSessionDurationMs());
      await manager.save(Session, session);
      return true;
    });

    if (!rotated) {
      // Reuse detection: a session still exists for this user, but not for the presented
      // token. That means an already-rotated (or revoked) refresh token came back, which
      // is the classic replay signal — drop every session so the attacker and the real
      // owner are both forced to sign in again. When no live session remains there is
      // nothing to steal, so we only reject.
      const stillActive = await this.sessionRepository.findOne({
        where: { userId: user.id, expiresAt: MoreThan(new Date()) },
      });
      if (stillActive) {
        await this.sessionRepository.delete({ userId: user.id });
      }
      throw new UnauthorizedException('Invalid or expired session');
    }

    return {
      ...this.generateTokens(user, newSessionToken, true),
      rememberMe: true,
    };
  }

  async logout(userId: string) {
    await this.sessionRepository.delete({ userId });
  }

  async logoutByRefreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: ENVIRONMENT.JWT.REFRESH_SECRET,
      }) as { sub: string; sid?: string };
      if (payload.sid) {
        const hashedToken = hashSessionToken(payload.sid);
        await this.sessionRepository.delete({ userId: payload.sub, token: hashedToken });
        await this.sessionRepository.delete({ userId: payload.sub, token: payload.sid });
      } else {
        await this.sessionRepository.delete({ userId: payload.sub });
      }
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getActiveSessionsForUser(userId: string) {
    return this.sessionRepository.find({
      where: { userId, expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
  }
}
