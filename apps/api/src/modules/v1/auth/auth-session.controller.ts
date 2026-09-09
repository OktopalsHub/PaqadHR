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
import {
  createGoogleOAuthConsentClaims,
  GOOGLE_OAUTH_CONSENT_COOKIE,
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
    res.cookie(GOOGLE_OAUTH_CONSENT_COOKIE, token, {
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
    res.clearCookie(GOOGLE_OAUTH_CONSENT_COOKIE, this.cookieOptions());
    const frontend = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    res.redirect(`${frontend}/google/complete`);
  }

  @Post('clear-access')
  @Public()
  clearAccess(@Res({ passthrough: true }) res: Response): { message: string } {
    res.clearCookie('access_token', this.cookieOptions());
    return { message: 'Access cleared' };
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const isProduction = (process.env.NODE_ENV || 'development') === 'production';
    const refreshToken = isProduction
      ? req.cookies.refresh_token
      : body.refreshToken || req.cookies.refresh_token;
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
    const refreshToken = req.cookies.refresh_token;
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
    const maxAge = 30 * 24 * 60 * 60 * 1000;
    const options = this.cookieOptions();
    res.cookie('access_token', accessToken, {
      ...options,
      maxAge,
    });
    res.cookie('refresh_token', refreshToken, {
      ...options,
      maxAge,
    });
  }

  private clearAuthCookies(res: Response) {
    const options = this.cookieOptions();
    res.clearCookie('access_token', options);
    res.clearCookie('refresh_token', options);
  }
}
