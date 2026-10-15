import { Body, Controller, Get, Ip, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from 'src/common/decorators';
import type { JwtPayload } from 'src/common/interfaces';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto, SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthPasswordController {
  constructor(private authService: AuthService) {}

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
}
