import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employment } from 'src/modules/v1/employment/entities/employment.entity';
import { ManagerAccessService } from '../services/manager-access.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Employment])],
  providers: [ManagerAccessService],
  exports: [ManagerAccessService],
})
export class ManagerAccessModule {}
