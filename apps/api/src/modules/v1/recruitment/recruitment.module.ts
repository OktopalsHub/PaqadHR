import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileModule } from 'src/common/modules/file.module';
import { DepartmentExistsConstraint } from 'src/common/validators/department-exists.validator';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CandidateService } from './services/candidate.service';
import { InterviewService } from './services/interview.service';
import { JobOpeningService } from './services/job-opening.service';
import { JobOpening } from "./entities/job-opening.entity";
import { Candidate } from "./entities/candidate.entity";
import { Interview } from "./entities/interview.entity";
import { Assessment } from "./entities/assessment.entity";
import { Department } from "../departments/entities/department.entity";
import { ApplicationController } from "./controllers/application.controller";
import { CandidateController } from "./controllers/candidate.controller";
import { JobOpeningController } from "./controllers/job-opening.controller";
import { InterviewController } from "./controllers/interview.controller";
import { PublicJobController } from "./controllers/public-job.controller";
import { JobOpeningRepository } from "./repositories/job-opening.repository";
import { CandidateRepository } from "./repositories/index";
import { InterviewRepository } from "./repositories/interview.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobOpening,
      Candidate,
      Interview,
      Assessment,
      Department,
    ]),
    FileModule,
    TenantsModule,
    TenantMembersModule,
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
  ],
  exports: [JobOpeningService, CandidateService, InterviewService],
})
export class RecruitmentModule {}
