import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-google-oauth20';
import { getPrivacyPolicyVersion } from 'src/common/config/privacy.config';
import { StringUtility } from 'src/common/utils';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import type { User } from '../../users/entities/user.entity';
import { AuthService } from '../auth.service';
import {
  consentTokensMatch,
  GOOGLE_OAUTH_CONSENT_COOKIE,
  verifyGoogleOAuthConsent,
} from '../utils/google-oauth-state.util';

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
    const stateParam = typeof req.query?.state === 'string' ? req.query.state : undefined;
    const cookieToken =
      typeof req.cookies?.[GOOGLE_OAUTH_CONSENT_COOKIE] === 'string'
        ? req.cookies[GOOGLE_OAUTH_CONSENT_COOKIE]
        : undefined;

    if (!consentTokensMatch(cookieToken, stateParam)) {
      throw new UnauthorizedException('Invalid Google sign-in consent');
    }

    const claims = verifyGoogleOAuthConsent(stateParam);
    if (!claims?.termsAccepted) {
      throw new UnauthorizedException('Invalid Google sign-in consent');
    }
    if (claims.privacyPolicyVersion !== getPrivacyPolicyVersion()) {
      throw new BadRequestException(
        'The privacy policy was updated. Please accept the current policy and try again.',
      );
    }

    return this.authService.findOrCreateGoogleUser(
      id,
      email,
      { ip, headers: req.headers },
      true,
      claims.privacyPolicyVersion,
    );
  }
}
