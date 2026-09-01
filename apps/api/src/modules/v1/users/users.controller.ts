import { Body, Controller, Delete, Get, Header, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthOnly, CurrentUser, RateLimit, RateLimitPresets } from 'src/common/decorators';
import { UserRole } from 'src/common/enums';
import type { IAuthenticatedUserRequest } from 'src/common/interfaces';
import { RoleGuard, Roles } from '../../../common/guards';
import { AcceptPrivacyConsentDto } from './dto/accept-privacy-consent.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@AuthOnly()
export class UsersController {
  constructor(private usersService: UsersService) {}
  @Get('profile')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  async getProfile(@CurrentUser() req: IAuthenticatedUserRequest): Promise<UserResponseDto | null> {
    const user = await this.usersService.getProfile(req.auth.principalId);
    if (!user) return null;
    const userResponse: UserResponseDto = UserResponseDto.toResponse(user);
    return userResponse;
  }
  @Delete('account')
  @RateLimit(RateLimitPresets.SENSITIVE)
  async deleteAccount(@CurrentUser() req: IAuthenticatedUserRequest): Promise<{ message: string }> {
    await this.usersService.deleteAccount(req.auth.principalId);
    return { message: 'Account deleted successfully' };
  }

  @Get('me/data-export')
  @RateLimit(RateLimitPresets.SENSITIVE)
  async exportMyData(
    @CurrentUser() req: IAuthenticatedUserRequest,
  ): Promise<Record<string, unknown>> {
    return this.usersService.exportUserData(req.auth.principalId);
  }

  @Get('me/privacy-consent')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  async getPrivacyConsentStatus(@CurrentUser() req: IAuthenticatedUserRequest): Promise<{
    currentVersion: string;
    acceptedVersion: string | null;
    needsReconsent: boolean;
  }> {
    return this.usersService.getPrivacyConsentStatus(req.auth.principalId);
  }

  @Post('me/privacy-consent')
  @RateLimit(RateLimitPresets.SENSITIVE)
  async acceptPrivacyPolicy(
    @CurrentUser() req: IAuthenticatedUserRequest,
    @Body() dto: AcceptPrivacyConsentDto,
  ): Promise<{ message: string }> {
    await this.usersService.acceptPrivacyPolicy(req.auth.principalId);
    return { message: 'Privacy policy accepted' };
  }

  @Get()
  @UseGuards(RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async listUsers(): Promise<UserResponseDto[]> {
    const users = await this.usersService.getUsers();
    const userResponse: UserResponseDto[] = UserResponseDto.toResponseList(users);
    return userResponse;
  }
  @Get(':userId')
  @UseGuards(RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getUser(@Param('userId') userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.getUser(userId);
    const userResponse: UserResponseDto = UserResponseDto.toResponse(user);
    return userResponse;
  }
}
