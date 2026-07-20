import {
  Body,
  Controller,
  Get,
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
import { Public } from 'src/common/decorators';
import type { JwtPayload } from 'src/common/interfaces';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import type { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto, SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface AuthUserResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

interface RegisterResponse extends AuthUserResponse {
  invitation?: unknown;
}

type AuthenticatedRequest = Request & { user: User };

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Public()
  async register(
    @Body() body: RegisterDto,
    @Ip() ipParam: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RegisterResponse> {
    const ip = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, ipParam);
    const { user, invitation } = await this.authService.register(
      body.email,
      body.password,
      { ip, headers: req.headers },
      undefined,
    );
    const { accessToken, refreshToken } = await this.authService.login(user, {
      ip,
      headers: req.headers,
    });
    this.setAuthCookies(res, accessToken, refreshToken);
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      ...(invitation ? { invitation } : {}),
    };
  }

  @Post('login')
  @Public()
  @UseGuards(AuthGuard('local'))
  async login(
    @Req() req: AuthenticatedRequest,
    @Ip() ipParam: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponse> {
    const ip = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, ipParam);
    const { accessToken, refreshToken } = await this.authService.login(req.user, {
      ip,
      headers: req.headers,
    });
    this.setAuthCookies(res, accessToken, refreshToken);
    return {
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    };
  }

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleLogin(@Query('redirect_uri') _redirectUri?: string) {}

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: AuthenticatedRequest,
    @Ip() ipParam: string,
    @Res() res: Response,
  ): Promise<void> {
    const ip = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, ipParam);
    const { accessToken, refreshToken } = await this.authService.login(req.user, {
      ip,
      headers: req.headers,
    });
    this.setAuthCookies(res, accessToken, refreshToken);
    const frontend = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    res.redirect(`${frontend}/google/complete`);
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const refreshToken = body.refreshToken || req.cookies.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refreshToken(refreshToken);
    this.setAuthCookies(res, accessToken, newRefreshToken);
    return { message: 'Token refreshed' };
  }

  @Post('forgot-password')
  @Public()
  async forgotPassword(@Body() body: ForgotPasswordDto, @Ip() ip: string, @Req() req: Request) {
    const clientIp = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, ip);
    return this.authService.forgotPassword(body.email, clientIp);
  }

  @Post('reset-password')
  @Public()
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Get('security')
  async getSecurity(@Req() req: Request) {
    const user = req.user as JwtPayload | undefined;
    if (!user?.principalId) {
      throw new UnauthorizedException('Not authenticated');
    }
    const canChangePassword = await this.authService.hasCredentialAccount(user.principalId);
    return { canChangePassword };
  }

  @Post('otp/send')
  async sendOtp(@Req() req: Request, @Body() body: SendOtpDto) {
    const user = req.user as JwtPayload | undefined;
    if (!user?.principalId || !user.email) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.authService.sendOtp(user.principalId, user.email, body.purpose);
  }

  @Post('otp/verify')
  async verifyOtp(@Req() req: Request, @Body() body: VerifyOtpDto) {
    const user = req.user as JwtPayload | undefined;
    if (!user?.principalId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.authService.verifyOtp(user.principalId, body.purpose, body.code);
  }

  @Post('change-password')
  async changePassword(@Req() req: Request, @Body() body: ChangePasswordDto) {
    const user = req.user as JwtPayload | undefined;
    if (!user?.principalId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.authService.changePassword(user.principalId, body.otpProof, body.newPassword);
  }

  @Post('logout')
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
    const isLocal = process.env.NODE_ENV !== 'production';
    const domain = !isLocal && process.env.APP_DOMAIN ? `.${process.env.APP_DOMAIN}` : undefined;
    return {
      httpOnly: true,
      secure: !isLocal,
      sameSite: isLocal ? ('lax' as const) : ('none' as const),
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const accessMaxAge = 24 * 60 * 60 * 1000;
    const refreshMaxAge = 7 * 24 * 60 * 60 * 1000;
    const options = this.cookieOptions();
    res.cookie('access_token', accessToken, {
      ...options,
      maxAge: accessMaxAge,
    });
    res.cookie('refresh_token', refreshToken, {
      ...options,
      maxAge: refreshMaxAge,
    });
  }

  private clearAuthCookies(res: Response) {
    const options = this.cookieOptions();
    res.clearCookie('access_token', options);
    res.clearCookie('refresh_token', options);
  }
}
