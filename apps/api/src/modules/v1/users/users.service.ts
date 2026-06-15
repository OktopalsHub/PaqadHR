import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../auth/entities/session.entity';
import type { User } from './entities/user.entity';
import { UserRepository } from './repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findUser(userId);
    if (!user) {
      throw new NotFoundException('User Not found');
    }
    return user;
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.userRepository.findUser(userId);
    await Promise.all([
      this.sessionRepository.delete({ userId }),
      this.userRepository.softDelete(userId),
    ]);
  }

  async getUsers(): Promise<User[]> {
    return this.userRepository.listUsers();
  }

  async getUser(id: string): Promise<User> {
    const user = await this.userRepository.findUser(id);
    if (!user) {
      throw new NotFoundException('User Not found');
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findUserByEmail(email);
  }

  async createUser(data: Partial<User>): Promise<User> {
    return this.userRepository.insertUser(data);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    await this.getUser(id);
    await this.userRepository.update(id, data as Parameters<UserRepository['update']>[1]);
    return this.getUser(id);
  }
}
