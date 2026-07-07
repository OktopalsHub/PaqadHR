import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { StringUtility } from 'src/common/utils';
import { DataSource, Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(
    @InjectRepository(User) readonly userRepository: Repository<User>,
    _dataSource: DataSource,
  ) {
    super(userRepository.target, userRepository.manager, userRepository.queryRunner);
  }

  async findUserByEmail(email: string, includeDeleted = false): Promise<User | null> {
    const normalizedEmail = StringUtility.trimAndLowerCase(email);
    if (!normalizedEmail) return null;

    const qb = this.createQueryBuilder('user').where('LOWER(TRIM(user.email)) = :email', {
      email: normalizedEmail,
    });
    if (includeDeleted) {
      qb.withDeleted();
    }
    const user = await qb.getOne();

    if (user && user.email !== normalizedEmail) {
      await this.update(user.id, { email: normalizedEmail });
      user.email = normalizedEmail;
    }

    return user;
  }

  async findUser(id: string, includeDeleted = false): Promise<User | null> {
    return this.findOne({ where: { id }, withDeleted: includeDeleted });
  }

  async listUsers(includeDeleted = false): Promise<User[]> {
    return this.find({ withDeleted: includeDeleted });
  }

  async insertUser(userData: Partial<User>): Promise<User> {
    if (userData.email) {
      userData.email = StringUtility.trimAndLowerCase(userData.email);
    }
    const user = this.create(userData);
    return this.save(user);
  }
}
