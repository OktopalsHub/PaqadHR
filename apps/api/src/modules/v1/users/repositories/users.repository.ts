import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailHashService } from 'src/common/services/email-hash.service';
import { StringUtility } from 'src/common/utils';
import { DataSource, IsNull, Repository } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly emailHashService: EmailHashService,
    private dataSource: DataSource,
  ) {
    super(userRepository.target, userRepository.manager, userRepository.queryRunner);
  }

  async findUserByEmail(
    email: string,
    includeDeleted = false,
  ): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const emailHash = this.emailHashService.hashEmail(normalizedEmail);
    const userByHash = await this.findOne({
      where: { emailHash },
      withDeleted: includeDeleted,
    });
    if (
      userByHash?.email &&
      userByHash.email.toLowerCase().trim() === normalizedEmail
    ) {
      return userByHash;
    }
    const users = await this.find({ withDeleted: includeDeleted, where: { emailHash: IsNull() } });
    const foundUser = users.find(
      (user) => user.email?.toLowerCase().trim() === normalizedEmail,
    );
    if (foundUser) {
      await this.userRepository.update(foundUser.id, { emailHash });
    }
    return foundUser ?? null;
  }

  async findUserByGoogleId(googleId: string): Promise<User | null> {
    return this.findOne({ where: { googleId } });
  }

  async findUser(id: string, includeDeleted = false): Promise<User | null> {
    return this.findOne({ where: { id }, withDeleted: includeDeleted });
  }

  async listUsers(includeDeleted = false): Promise<User[]> {
    return this.find({ withDeleted: includeDeleted });
  }

  async insertUser(userData: Partial<User>): Promise<User> {
    if (userData.email) {
      const normalizedEmail = userData.email.toLowerCase().trim();
      userData.emailHash = this.emailHashService.hashEmail(normalizedEmail);
    }
    const user = this.create(userData);
    return this.save(user);
  }

  async createRefreshToken(user: User, expiresAt: Date): Promise<RefreshToken> {
    const token = this.refreshTokenRepository.create({
      user,
      token: StringUtility.generateRandomString(64),
      expiresAt,
      userId: user.id,
    });
    return this.refreshTokenRepository.save(token);
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.refreshTokenRepository.findOne({
      where: { token, isRevoked: false },
    });
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.refreshTokenRepository.update({ token }, { isRevoked: true });
  }
}
