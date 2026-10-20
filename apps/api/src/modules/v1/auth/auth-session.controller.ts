import {
  Body,
  Controller,
  Get,
  Header,
  Ip,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthOnly, CurrentUser, Public } from 'src/common/decorators';
import type { IAuthenticatedUserRequest, JwtPayload } from 'src/common/interfaces';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import {
  ACCESS_TOKEN_COOKIE,
  cookieName,
  REFRESH_TOKEN_COOKIE,
  resolveCookieDomain,
  usesCrossSiteCookies,
  usesSecureCookies,
} from '../../../common/config/cookie-deployment';
import type { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { GoogleConsentDto } from './dto/google-consent.dto';
import { ResendEmailVerificationDto, VerifyEmailDto } from './dto/otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import type { SessionBootstrapResponseDto } from './dto/session-bootstrap-response.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { AuthSessionService } from './services/auth-session.service';
import {
  createGoogleOAuthConsentClaims,
  GOOGLE_OAUTH_CONSENT_COOKIE_BASE,
  GOOGLE_OAUTH_CONSENT_TTL_MS,
  signGoogleOAuthConsent,
} from './utils/google-oauth-state.util';

interface AuthUserResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

interface RegisterResponse {
  email: string;
  verificationRequired: true;
}

type AuthenticatedRequest = Request & { user: User };

@ApiTags('Authentication')
@Controller('auth')
export class AuthSessionController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Public()
  async register(
    @Body() body: RegisterDto,
    @Ip() ipParam: string,
    @Req() req: Request,
  ): Promise<RegisterResponse> {
    const ip = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, ipParam);
    const { user } = await this.authService.register(
      body.email,
      body.password,
      { ip, headers: req.headers },
      undefined,
      body.termsAccepted,
      body.attribution,
    );
    return {
      email: user.email,
      verificationRequired: true,
    };
  }

  @Post('register/resend-verification')
  @Public()
  async resendEmailVerification(
    @Body() body: ResendEmailVerificationDto,
    @Ip() ipParam: string,
    @Req() req: Request,
  ) {
    const ip = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, ipParam);
    return this.authService.resendEmailVerification(body.email, ip);
  }

  @Post('register/verify-email')
  @Public()
  async verifyEmail(
    @Body() body: VerifyEmailDto,
    @Ip() ipParam: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponse> {
    const ip = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, ipParam);
    const user = await this.authService.verifyEmail(body.email, body.code);
    const { accessToken, refreshToken } = await this.authService.login(user, {
      ip,
      headers: req.headers,
    });
    this.setAuthCookies(res, accessToken, refreshToken, true);
    return { user: { id: user.id, email: user.email, role: user.role } };
  }

  @Post('login')
  @Public()
  @UseGuards(AuthGuard('local'))
  async login(
    @Req() req: AuthenticatedRequest,
    @Ip() ipParam: string,
    @Body() body: { rememberMe?: boolean },
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponse> {
    const ip = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, ipParam);
    const { accessToken, refreshToken } = await this.authService.login(
      req.user,
      { ip, headers: req.headers },
      undefined,
      body.rememberMe ?? true,
    );
    this.setAuthCookies(res, accessToken, refreshToken, true);
    return {
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    };
  }

  @Post('google/consent')
  @Public()
  prepareGoogleConsent(
    @Body() body: GoogleConsentDto,
    @Res({ passthrough: true }) res: Response,
  ): { ok: true } {
    void body;
    const token = signGoogleOAuthConsent(createGoogleOAuthConsentClaims());
    res.cookie(cookieName(GOOGLE_OAUTH_CONSENT_COOKIE_BASE), token, {
      ...this.cookieOptions(),
      maxAge: GOOGLE_OAUTH_CONSENT_TTL_MS,
    });
    return { ok: true };
  }

  @Get('google')
  @Public()
  @UseGuards(GoogleAuthGuard)
  async googleLogin(@Query('redirect_uri') _redirectUri?: string) {}

  @Get('google/callback')
  @Public()
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: AuthenticatedRequest,
    @Ip() ipParam: string,
    @Res() res: Response,
  ): Promise<void> {
    const ip = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, ipParam);
    const { accessToken, refreshToken } = await this.authService.login(
      req.user,
      { ip, headers: req.headers },
      undefined,
      true,
    );
    this.setAuthCookies(res, accessToken, refreshToken, true);
    res.clearCookie(cookieName(GOOGLE_OAUTH_CONSENT_COOKIE_BASE), this.cookieOptions());
    const configuredFrontendUrl =
      process.env.NODE_ENV === 'production'
        ? 'https://paqadhr.com'
        : process.env.FRONTEND_URL || 'http://localhost:3000';
    const frontendUrl = new URL(configuredFrontendUrl);
    const frontend = frontendUrl.toString().replace(/\/$/, '');
    // `/google/complete` used to be a permanent redirect to a tenant subdomain,
    // and browsers cache permanent redirects. The `?provider` marker lands the
    // browser on a URL that was never redirected, so clients holding the stale
    // 301 recover without clearing their cache.
    res.redirect(`${frontend}/google/complete?provider=google`);
  }

  @Post('clear-access')
  @Public()
  clearAccess(@Res({ passthrough: true }) res: Response): { message: string } {
    res.clearCookie(cookieName(ACCESS_TOKEN_COOKIE), this.cookieOptions());
    return { message: 'Access cleared' };
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Body() _body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const refreshToken = req.cookies[cookieName(REFRESH_TOKEN_COOKIE)];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const {
      accessToken,
      refreshToken: newRefreshToken,
      rememberMe,
    } = await this.authService.refreshToken(refreshToken);
    this.setAuthCookies(res, accessToken, newRefreshToken, rememberMe);
    return { message: 'Token refreshed' };
  }

  @Post('logout')
  @Public()
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const refreshToken = req.cookies[cookieName(REFRESH_TOKEN_COOKIE)];
    const user = req.user as JwtPayload | undefined;
    if (refreshToken) {
      await this.authService.logoutByRefreshToken(refreshToken);
    } else if (user?.principalId) {
      await this.authService.logout(user.principalId);
    }
    this.clearAuthCookies(res);
    res.json({ message: 'Logout successful' });
  }

  @Post('logout-all')
  async logoutAllDevices(@Req() req: Request, @Res() res: Response): Promise<void> {
    const user = req.user as JwtPayload | undefined;
    if (!user?.principalId) {
      throw new UnauthorizedException('Not authenticated');
    }
    await this.authService.logout(user.principalId);
    this.clearAuthCookies(res);
    res.json({ message: 'Logged out from all devices successfully' });
  }

  @Get('session')
  @AuthOnly()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  async getSession(
    @CurrentUser() req: IAuthenticatedUserRequest,
  ): Promise<SessionBootstrapResponseDto> {
    return this.authService.getSessionBootstrap(req.auth.principalId);
  }

  @Get('sessions')
  async getActiveSessions(@Req() req: Request): Promise<{ sessions: unknown[] }> {
    const user = req.user as JwtPayload | undefined;
    if (!user?.principalId) {
      throw new UnauthorizedException('Not authenticated');
    }
    const sessions = await this.authService.getActiveSessionsForUser(user.principalId);
    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })),
    };
  }

  private cookieOptions() {
    const crossSiteCookies = usesCrossSiteCookies();
    const secureCookies = usesSecureCookies();
    const domain = resolveCookieDomain();
    return {
      httpOnly: true,
      secure: secureCookies,
      sameSite: crossSiteCookies ? ('none' as const) : ('lax' as const),
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    _rememberMe = true,
  ) {
    const options = this.cookieOptions();
    res.cookie(cookieName(ACCESS_TOKEN_COOKIE), accessToken, {
      ...options,
      maxAge: AuthSessionService.getAccessDurationMs(),
    });
    res.cookie(cookieName(REFRESH_TOKEN_COOKIE), refreshToken, {
      ...options,
      maxAge: AuthSessionService.getRefreshDurationMs(),
    });
  }

  private clearAuthCookies(res: Response) {
    const options = this.cookieOptions();
    res.clearCookie(cookieName(ACCESS_TOKEN_COOKIE), options);
    res.clearCookie(cookieName(REFRESH_TOKEN_COOKIE), options);
  }
}
