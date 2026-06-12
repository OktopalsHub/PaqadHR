import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { StringUtility } from 'src/common/utils';
import { DataSource, Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {
    super(userRepository.target, userRepository.manager, userRepository.queryRunner);
  }

  async findUserByEmail(
    email: string,
    includeDeleted = false,
  ): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();
    return this.findOne({
      where: { email: normalizedEmail },
      withDeleted: includeDeleted,
    });
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
