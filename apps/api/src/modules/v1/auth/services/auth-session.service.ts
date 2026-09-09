import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ENVIRONMENT } from 'src/common/config/env.config';
import { Repository } from 'typeorm';
import type { User } from '../../users/entities/user.entity';
import { UserRepository } from '../../users/repositories/users.repository';
import { Session } from '../entities/session.entity';

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
      expiresIn: '30d',
    });
    return { accessToken, refreshToken };
  }

  async createSession(
    userId: string,
    ipAddress?: string | null,
    userAgent?: string | null,
    _rememberMe = true,
  ): Promise<Session> {
    const sessionToken = randomUUID();
    const durationMs = 30 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + durationMs);
    const session = this.sessionRepository.create({
      userId,
      token: sessionToken,
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
      await this.sessionRepository.delete({ userId: user.id });
      throw new UnauthorizedException('Verify your email address before signing in');
    }
    if (!payload.sid) return { ...this.generateTokens(user, payload.sid), rememberMe: true };
    const session = await this.sessionRepository.findOne({
      where: { token: payload.sid, userId: user.id },
    });
    if (!session) {
      await this.sessionRepository.delete({ userId: user.id });
      throw new UnauthorizedException('Invalid or expired session');
    }
    if (session.expiresAt < new Date()) {
      await this.sessionRepository.delete({ token: payload.sid });
      throw new UnauthorizedException('Invalid or expired session');
    }
    const newSessionToken = randomUUID();
    session.token = newSessionToken;
    session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.sessionRepository.save(session);
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
      if (payload.sid)
        await this.sessionRepository.delete({ userId: payload.sub, token: payload.sid });
      else await this.sessionRepository.delete({ userId: payload.sub });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getActiveSessionsForUser(userId: string) {
    return this.sessionRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }
}
