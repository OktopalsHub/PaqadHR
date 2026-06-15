import type { User } from '../entities/user.entity';

export interface IUserRepository {
  findUserByEmail(email: string, includeDeleted?: boolean): Promise<User | null>;
  findUser(id: string, includeDeleted?: boolean): Promise<User | null>;
  insertUser(userData: Partial<User>): Promise<User>;
}
