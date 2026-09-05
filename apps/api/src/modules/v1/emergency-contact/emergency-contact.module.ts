import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { EmergencyContactController } from './emergency-contact.controller';
import { EmergencyContactRepository } from './emergency-contact.repository';
import { EmergencyContactService } from './emergency-contact.service';
import { EmergencyContact } from './entities/emergency-contact.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmergencyContact]),
    forwardRef(() => TenantMembersModule),
    forwardRef(() => TenantsModule),
    forwardRef(() => ActivitiesModule),
  ],
  controllers: [EmergencyContactController],
  providers: [EmergencyContactService, EmergencyContactRepository],
  exports: [EmergencyContactService],
})
export class EmergencyContactModule {}
