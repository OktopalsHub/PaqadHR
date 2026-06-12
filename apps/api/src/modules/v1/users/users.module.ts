import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailHashService } from 'src/common/services/email-hash.service';
import { Session } from '../auth/entities/session.entity';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/users.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session])],
  controllers: [UsersController],
  providers: [UsersService, UserRepository, EmailHashService],
  exports: [UsersService, UserRepository],
})
export class UsersModule {}
