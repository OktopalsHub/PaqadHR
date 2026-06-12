import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENVIRONMENT } from 'src/common/config/env.config';
import { EmailHashService } from 'src/common/services/email-hash.service';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy, JwtStrategy, LocalStrategy } from './strategies';
import { InvitationsModule } from '../invitations/invitations.module';
import { UsersModule } from '../users/users.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { User } from "../users/entities/user.entity";
import { RefreshToken } from "../users/entities/refresh-token.entity";
import { UserRepository } from "../users/repositories/users.repository";
import { RefreshTokenRepository } from "../users/repositories/refresh-token.repository";

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
    TypeOrmModule.forFeature([User, RefreshToken]),
    InvitationsModule,
    UsersModule,
    TenantMembersModule,
    TenantsModule,
  ],
  providers: [
    AuthService,
    UserRepository,
    RefreshTokenRepository,
    EmailHashService,
    JwtStrategy,
    LocalStrategy,
    GoogleStrategy,
  ],
  exports: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
