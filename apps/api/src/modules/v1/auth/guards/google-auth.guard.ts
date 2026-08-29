import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { signGoogleOAuthState } from '../utils/google-oauth-state.util';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext): { state?: string } | undefined {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path ?? req.url ?? '';
    if (path.includes('/google/callback')) {
      return undefined;
    }

    const termsAccepted = String(req.query?.termsAccepted ?? '') === 'true';
    return { state: signGoogleOAuthState(termsAccepted) };
  }
}
