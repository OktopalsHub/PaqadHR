import {
  BadRequestException,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { getPrivacyPolicyVersion } from 'src/common/config/privacy.config';
import {
  GOOGLE_OAUTH_CONSENT_COOKIE,
  verifyGoogleOAuthConsent,
} from '../utils/google-oauth-state.util';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext): { state?: string } | undefined {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path ?? req.url ?? '';
    if (path.includes('/google/callback')) {
      return undefined;
    }

    const cookieToken =
      typeof req.cookies?.[GOOGLE_OAUTH_CONSENT_COOKIE] === 'string'
        ? req.cookies[GOOGLE_OAUTH_CONSENT_COOKIE]
        : undefined;
    const claims = verifyGoogleOAuthConsent(cookieToken);
    if (!claims?.termsAccepted) {
      throw new UnauthorizedException(
        'Accept the terms and privacy policy before continuing with Google',
      );
    }
    if (claims.privacyPolicyVersion !== getPrivacyPolicyVersion()) {
      throw new BadRequestException(
        'The privacy policy was updated. Please accept the current policy and try again.',
      );
    }

    // Bind OAuth state to the browser consent cookie (same signed token).
    return { state: cookieToken };
  }
}
