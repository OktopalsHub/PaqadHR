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
import { Request, Response } from 'express';
import { Public } from 'src/common/decorators';
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
    @Body() body: { email: string; password: string },
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse & { invitation?: unknown }> {
    const ipAddress = req.headers['x-forwarded-for'] ?? ip;
    const { user, invitation } = await this.authService.register(
      body.email,
      body.password,
      typeof ipAddress === 'string' ? ipAddress : '',
    );
    const { accessToken, refreshToken } = await this.authService.login(
      user,
      ip,
    );
    this.setAuthCookies(res, accessToken, refreshToken);
    const response = {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      ...(invitation ? { invitation } : {}),
    };
    return response;
  }
  @Post('login')
  @Public()
  @UseGuards(AuthGuard('local'))
  async login(
    @Req() req,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { accessToken, refreshToken } = await this.authService.login(
      req.user,
      ip,
    );
    this.setAuthCookies(res, accessToken, refreshToken);
    const response = {
      accessToken,
      refreshToken,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    };
    return response;
  }
  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleLogin(@Query('redirect_uri') redirectUri?: string) {}
  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { accessToken, refreshToken } = await this.authService.login(
      req.user,
      ip,
    );
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
    const refreshToken = body.refreshToken || req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refreshToken(refreshToken);
    this.setAuthCookies(res, accessToken, newRefreshToken);
    return { accessToken, refreshToken: newRefreshToken };
  }
  @Post('logout')
    async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const refreshToken = req.cookies['refresh_token'];
    if (refreshToken) await this.authService.logout(refreshToken);
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
    res.json({ message: 'Logout successful' });
  }
  @Post('logout-all')
    async logoutAllDevices(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const token = await this.authService.validateRefreshToken(refreshToken);
    await this.authService.revokeAllRefreshTokensForUser(token.userId);
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
    res.json({ message: 'Logged out from all devices successfully' });
  }
  @Get('sessions')
    async getActiveSessions(@Req() req: Request): Promise<{ sessions: unknown[] }> {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const token = await this.authService.validateRefreshToken(refreshToken);
    const activeTokens = await this.authService.getActiveRefreshTokensForUser(
      token.userId,
    );
    const sessions = activeTokens.map((token) => ({
      id: token.id,
      deviceInfo: 'Unknown', 
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      lastUsed: token.createdAt, 
    }));
    return { sessions };
  }
  private extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
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
}
