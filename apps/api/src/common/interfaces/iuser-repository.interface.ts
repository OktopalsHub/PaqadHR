import { Repository } from 'typeorm';
import type { User } from '../../modules/v1/users/entities/user.entity';

export interface IUserRepository extends Repository<User> {
  findByEmail(email: string, includeDeleted?: boolean): Promise<User | null>;
}
