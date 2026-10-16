import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import {
  cookieName,
  resolveCookieDomain,
  usesCrossSiteCookies,
  usesSecureCookies,
} from 'src/common/config/cookie-deployment';
import {
  createGoogleOAuthConsentClaims,
  GOOGLE_OAUTH_CONSENT_COOKIE_BASE,
  GOOGLE_OAUTH_CONSENT_TTL_MS,
  signGoogleOAuthConsent,
} from '../utils/google-oauth-state.util';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext): { state?: string } | undefined {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path ?? req.url ?? '';
    if (path.includes('/google/callback')) {
      return undefined;
    }

    // Clicking "Continue with Google" is the user's acceptance of the linked terms
    // and privacy policy. Create consent and OAuth state in the same response so
    // a separate cross-origin preflight request cannot lose the consent cookie.
    const token = signGoogleOAuthConsent(createGoogleOAuthConsentClaims());
    const response = context.switchToHttp().getResponse<Response>();
    const crossSiteCookies = usesCrossSiteCookies();
    const domain = resolveCookieDomain();

    response.cookie(cookieName(GOOGLE_OAUTH_CONSENT_COOKIE_BASE), token, {
      httpOnly: true,
      secure: usesSecureCookies(),
      sameSite: crossSiteCookies ? 'none' : 'lax',
      path: '/',
      ...(domain ? { domain } : {}),
      maxAge: GOOGLE_OAUTH_CONSENT_TTL_MS,
    });

    // Bind OAuth state to the browser consent cookie (same signed token).
    return { state: token };
  }
}
