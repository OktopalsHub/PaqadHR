import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getPrivacyPolicyVersion } from 'src/common/config/privacy.config';
import { UserRole } from 'src/common/enums';
import { GeoLocationHelper, StringUtility } from 'src/common/utils';
import type { GeoRequestContext } from 'src/common/utils/geo-location.util';
import { Repository } from 'typeorm';
import type { User } from '../../users/entities/user.entity';
import { buildUserConsentMetadata } from '../../users/interfaces/user-metadata.interface';
import { UserRepository } from '../../users/repositories/users.repository';
import { Account } from '../entities/account.entity';

@Injectable()
export class AuthOAuthService {
  constructor(
    private readonly userRepository: UserRepository,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async findOrCreateGoogleUser(
    googleId: string,
    email: string,
    geo: GeoRequestContext = {},
    termsAccepted = false,
    acceptedPolicyVersion?: string,
  ): Promise<User> {
    const normalizedEmail = StringUtility.trimAndLowerCase(email);
    const existingAccount = await this.accountRepository.findOne({
      where: { providerId: 'google', accountId: googleId },
      relations: ['user'],
    });
    if (existingAccount?.user) return existingAccount.user;
    const existingUser = await this.userRepository.findUserByEmail(normalizedEmail);
    if (existingUser) {
      if (!existingUser.isActive) throw new UnauthorizedException('User account is inactive');
      const linkedGoogle = await this.accountRepository.findOne({
        where: { userId: existingUser.id, providerId: 'google' },
      });
      if (linkedGoogle) {
        if (linkedGoogle.accountId !== googleId) {
          linkedGoogle.accountId = googleId;
          await this.accountRepository.save(linkedGoogle);
        }
        if (!existingUser.emailVerified) {
          await this.userRepository.update(existingUser.id, { emailVerified: true });
          existingUser.emailVerified = true;
        }
        return existingUser;
      }
      await this.accountRepository.save(
        this.accountRepository.create({
          userId: existingUser.id,
          providerId: 'google',
          accountId: googleId,
        }),
      );
      if (!existingUser.emailVerified) {
        await this.userRepository.update(existingUser.id, { emailVerified: true });
        existingUser.emailVerified = true;
      }
      return existingUser;
    }
    if (termsAccepted !== true)
      throw new BadRequestException('You must accept the terms and privacy policy to continue');
    const currentVersion = getPrivacyPolicyVersion();
    if (!acceptedPolicyVersion || acceptedPolicyVersion !== currentVersion)
      throw new BadRequestException(
        'The privacy policy was updated. Please accept the current policy and try again.',
      );
    const countryCode = await GeoLocationHelper.resolveUserCountryCode(geo);
    const user = await this.userRepository.insertUser({
      email: normalizedEmail,
      role: UserRole.BASIC,
      countryCode,
      emailVerified: true,
      metadata: buildUserConsentMetadata(true),
    });
    await this.accountRepository.save(
      this.accountRepository.create({ userId: user.id, providerId: 'google', accountId: googleId }),
    );
    return user;
  }
}
