import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthOnly, CurrentUser } from 'src/common/decorators';
import { UserRole } from 'src/common/enums';
import type { IAuthenticatedUserRequest } from 'src/common/interfaces';
import { RoleGuard, Roles } from '../../../common/guards';
import { UserResponseDto } from './dto/user-response.dto';
import type { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@AuthOnly()
export class UsersController {
  constructor(private usersService: UsersService) {}
  @Get('profile')
  async getProfile(@CurrentUser() req: IAuthenticatedUserRequest): Promise<UserResponseDto | null> {
    const user = await this.usersService.getProfile(req.auth.principalId);
    if (!user) return null;
    const userResponse: UserResponseDto = UserResponseDto.toResponse(user);
    return userResponse;
  }
  @Delete('account')
  async deleteAccount(@CurrentUser() req: IAuthenticatedUserRequest): Promise<{ message: string }> {
    await this.usersService.deleteAccount(req.auth.principalId);
    return { message: 'Account deleted successfully' };
  }
  @Get()
  @UseGuards(RoleGuard)
  @Roles(UserRole.ADMIN)
  @Roles(UserRole.SUPER_ADMIN)
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
