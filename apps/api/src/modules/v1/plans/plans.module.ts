import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeoInterceptor } from 'src/common/interceptors/geo.interceptor';
import { PlansAdminController } from './controllers/plans-admin.controller';
import { PlansController } from './controllers/plans.controller';
import { PlanPrice } from './entities/plan-price.entity';
import { Plan } from './entities/plan.entity';
import { PlansService } from './services/plans.service';

@Module({
  imports: [TypeOrmModule.forFeature([Plan, PlanPrice])],
  controllers: [PlansController, PlansAdminController],
  providers: [
    PlansService,
    { provide: APP_INTERCEPTOR, useClass: GeoInterceptor },
  ],
  exports: [PlansService],
})
export class PlansModule {}
