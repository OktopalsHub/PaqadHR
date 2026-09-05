import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AddressController } from './address.controller';
import { AddressRepository } from './address.repository';
import { AddressService } from './address.service';
import { Address } from './entities/address.entity';
import { MemberAddressController } from './member-address.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Address]),
    TenantsModule,
    TenantMembersModule,
    ActivitiesModule,
  ],
  controllers: [AddressController, MemberAddressController],
  providers: [AddressService, AddressRepository],
  exports: [AddressService],
})
export class AddressModule {}
