import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailHashService } from 'src/common/services/email-hash.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from "./entities/user.entity";
import { RefreshToken } from "./entities/refresh-token.entity";
import { UserRepository } from "./repositories/users.repository";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken])],
  controllers: [UsersController],
  providers: [
    UsersService,
    UserRepository,
    RefreshTokenRepository,
    EmailHashService,
  ],
  exports: [UsersService],
})
export class UsersModule {}
