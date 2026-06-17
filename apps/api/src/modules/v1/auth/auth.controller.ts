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
import { AuthService } from './auth.service';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Public()
  async register(
    @Body() body: { email: string; password: string; name?: string },
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse & { invitation?: unknown }> {
    const ipAddress = req.headers['x-forwarded-for'] ?? ip;
    const { user, invitation } = await this.authService.register(
      body.email,
      body.password,
      typeof ipAddress === 'string' ? ipAddress : '',
      undefined,
      undefined,
      body.name,
    );
    const { accessToken, refreshToken } = await this.authService.login(user, ip);
    this.setAuthCookies(res, accessToken, refreshToken);
    return {
      accessToken,
      refreshToken,
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
    @Req() req,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { accessToken, refreshToken } = await this.authService.login(req.user, ip);
    this.setAuthCookies(res, accessToken, refreshToken);
    return {
      accessToken,
      refreshToken,
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
    @Req() req,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { accessToken, refreshToken } = await this.authService.login(req.user, ip);
    this.setAuthCookies(res, accessToken, refreshToken);
    return {
      accessToken,
      refreshToken,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    };
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshToken = body.refreshToken || req.cookies.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refreshToken(refreshToken);
    this.setAuthCookies(res, accessToken, newRefreshToken);
    return { accessToken, refreshToken: newRefreshToken };
  }

  @Post('forgot-password')
  @Public()
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @Public()
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
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

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const accessMaxAge = 24 * 60 * 60 * 1000;
    const refreshMaxAge = 7 * 24 * 60 * 60 * 1000;
    const isLocal = process.env.NODE_ENV !== 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: isLocal ? 'lax' : 'none',
      maxAge: accessMaxAge,
      path: '/',
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: isLocal ? 'lax' : 'none',
      maxAge: refreshMaxAge,
      path: '/',
    });
  }

  private clearAuthCookies(res: Response) {
    const isLocal = process.env.NODE_ENV !== 'production';
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: !isLocal,
      sameSite: isLocal ? 'lax' : 'none',
      path: '/',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: !isLocal,
      sameSite: isLocal ? 'lax' : 'none',
      path: '/',
    });
  }
}
