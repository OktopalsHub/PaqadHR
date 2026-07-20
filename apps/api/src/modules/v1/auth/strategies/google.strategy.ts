import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import type { Request } from 'express';
import { StringUtility } from 'src/common/utils';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import type { User } from '../../users/entities/user.entity';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL ?? '',
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }
  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: {
      id: string;
      emails: Array<{ value: string }>;
    },
  ): Promise<User> {
    const { id, emails } = profile;
    const email = StringUtility.trimAndLowerCase(emails[0].value);
    const ip = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, req.ip);
    return this.authService.findOrCreateGoogleUser(id, email, { ip, headers: req.headers });
  }
}
