import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { AddressController } from './address.controller';
import { AddressRepository } from './address.repository';
import { AddressService } from './address.service';
import { Address } from "./entities/address.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Address]),
    TenantsModule,
    TenantMembersModule,
  ],
  controllers: [AddressController],
  providers: [AddressService, AddressRepository],
  exports: [AddressService],
})
export class AddressModule {}
