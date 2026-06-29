import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailHashService } from 'src/common/services/email-hash.service';
import { Account } from '../auth/entities/account.entity';
import { Session } from '../auth/entities/session.entity';
import { PaymentMethod } from '../payment-method/entities/payment-method.entity';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/users.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session, Account, TenantMember, PaymentMethod])],
  controllers: [UsersController],
  providers: [UsersService, UserRepository, EmailHashService],
  exports: [UsersService, UserRepository],
})
export class UsersModule {}
