import { UserRole } from 'src/common/enums';
import { User } from '../entities/user.entity';

export class UserResponseDto {
  id: string;
  email: string;
  isActive: boolean;
  role: UserRole;
  countryCode: string;
  imageKey?: string | null;

  static toResponse(user: User): UserResponseDto {
    const response = new UserResponseDto();
    response.id = user.id;
    response.email = user.email;
    response.isActive = user.isActive;
    response.role = user.role as UserRole;
    response.countryCode = user.countryCode;
    response.imageKey = user.imageKey;
    return response;
  }

  static toResponseList(users: User[]): UserResponseDto[] {
    return users.map((user) => this.toResponse(user));
  }
}
