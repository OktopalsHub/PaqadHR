import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileModule } from 'src/common/modules/file.module';
import { TurnstileService } from 'src/common/services/turnstile.service';
import { DepartmentExistsConstraint } from 'src/common/validators/department-exists.validator';
import { ActivitiesModule } from '../activities/activities.module';
import { Department } from '../departments/entities/department.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { ApplicationController } from './controllers/application.controller';
import { CandidateController } from './controllers/candidate.controller';
import { InterviewController } from './controllers/interview.controller';
import { JobOpeningController } from './controllers/job-opening.controller';
import { PublicJobController } from './controllers/public-job.controller';
import { Assessment } from './entities/assessment.entity';
import { Candidate } from './entities/candidate.entity';
import { Interview } from './entities/interview.entity';
import { JobOpening } from './entities/job-opening.entity';
import { CandidateRepository } from './repositories/index';
import { InterviewRepository } from './repositories/interview.repository';
import { JobOpeningRepository } from './repositories/job-opening.repository';
import { CandidateService } from './services/candidate.service';
import { InterviewService } from './services/interview.service';
import { JobOpeningService } from './services/job-opening.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobOpening, Candidate, Interview, Assessment, Department]),
    FileModule,
    forwardRef(() => TenantsModule),
    forwardRef(() => TenantMembersModule),
    forwardRef(() => SubscriptionsModule),
    forwardRef(() => ActivitiesModule),
  ],
  controllers: [
    ApplicationController,
    CandidateController,
    JobOpeningController,
    InterviewController,
    PublicJobController,
  ],
  providers: [
    JobOpeningService,
    JobOpeningRepository,
    CandidateService,
    CandidateRepository,
    InterviewRepository,
    InterviewService,
    DepartmentExistsConstraint,
    TurnstileService,
  ],
  exports: [JobOpeningService, CandidateService, InterviewService],
})
export class RecruitmentModule {}
