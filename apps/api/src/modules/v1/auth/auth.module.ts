import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENVIRONMENT } from 'src/common/config/env.config';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy, JwtStrategy, LocalStrategy } from './strategies';
import { InvitationsModule } from '../invitations/invitations.module';
import { UsersModule } from '../users/users.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { User } from '../users/entities/user.entity';
import { UserRepository } from '../users/repositories/users.repository';
import { Account } from './entities/account.entity';
import { Session } from './entities/session.entity';
import { Verification } from './entities/verification.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: ENVIRONMENT.JWT.ACCESS_SECRET,
      signOptions: {
        expiresIn: ENVIRONMENT.JWT.ACCESS_EXPIRES_IN as
          | number
          | `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    }),
    TypeOrmModule.forFeature([User, Account, Session, Verification]),
    InvitationsModule,
    UsersModule,
    TenantMembersModule,
    TenantsModule,
  ],
  providers: [
    AuthService,
    UserRepository,
    JwtStrategy,
    LocalStrategy,
    GoogleStrategy,
  ],
  exports: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
