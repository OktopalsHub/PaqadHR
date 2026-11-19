import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileModule } from 'src/common/modules/file.module';
import { TurnstileService } from 'src/common/services/turnstile.service';
import { DepartmentExistsConstraint } from 'src/common/validators/department-exists.validator';

import { ActivitiesModule } from '../activities/activities.module';
import { Department } from '../departments/entities/department.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantsModule } from '../tenants/tenants.module';
import { ApplicationController } from './controllers/application.controller';
import { CandidateController } from './controllers/candidate.controller';
import { InterviewController } from './controllers/interview.controller';
import { JobOpeningController } from './controllers/job-opening.controller';
import { PublicJobController } from './controllers/public-job.controller';
import { RecruitmentAtsController } from './controllers/recruitment-ats.controller';
import { RecruitmentExtrasController } from './controllers/recruitment-extras.controller';
import { Assessment } from './entities/assessment.entity';
import { CandidateStageHistory } from './entities/candidate-stage-history.entity';
import { Candidate } from './entities/candidate.entity';
import { Interview } from './entities/interview.entity';
import { JobOpening } from './entities/job-opening.entity';
import { PipelineStage } from './entities/pipeline-stage.entity';
import { RecruitmentEmailLog } from './entities/recruitment-email-log.entity';
import { RecruitmentEmailTemplate } from './entities/recruitment-email-template.entity';
import { RecruitmentOffer } from './entities/recruitment-offer.entity';
import { RecruitmentScorecard } from './entities/recruitment-scorecard.entity';
import { CandidateRepository } from './repositories/index';
import { InterviewRepository } from './repositories/interview.repository';
import { JobOpeningRepository } from './repositories/job-opening.repository';
import { CandidateService } from './services/candidate.service';
import { InterviewFeedbackService } from './services/interview-feedback.service';
import { InterviewSchedulingService } from './services/interview-scheduling.service';
import { InterviewService } from './services/interview.service';
import { JobOpeningService } from './services/job-opening.service';
import { RecruitmentAiService } from './services/recruitment-ai.service';
import { RecruitmentCandidateMailer } from './services/recruitment-candidate-mailer.service';
import { RecruitmentEmailTemplateService } from './services/recruitment-email-template.service';
import { RecruitmentOfferService } from './services/recruitment-offer.service';
import { RecruitmentPipelineService } from './services/recruitment-pipeline.service';
import { RecruitmentScorecardService } from './services/recruitment-scorecard.service';
import { RecruitmentTalentPoolService } from './services/recruitment-talent-pool.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobOpening,
      Candidate,
      Interview,
      Assessment,
      Department,
      Tenant,
      PipelineStage,
      CandidateStageHistory,
      RecruitmentEmailLog,
      RecruitmentEmailTemplate,
      RecruitmentScorecard,
      RecruitmentOffer,
    ]),
    FileModule,
    TenantsModule,
    TenantMembersModule,
    SubscriptionsModule,
    ActivitiesModule,
    NotificationsModule,
  ],
  controllers: [
    ApplicationController,
    CandidateController,
    JobOpeningController,
    InterviewController,
    PublicJobController,
    RecruitmentAtsController,
    RecruitmentExtrasController,
  ],
  providers: [
    JobOpeningService,
    JobOpeningRepository,
    CandidateService,
    CandidateRepository,
    InterviewRepository,
    InterviewSchedulingService,
    InterviewFeedbackService,
    InterviewService,
    RecruitmentAiService,
    RecruitmentScorecardService,
    RecruitmentOfferService,
    RecruitmentTalentPoolService,
    RecruitmentEmailTemplateService,
    RecruitmentCandidateMailer,
    RecruitmentPipelineService,
    DepartmentExistsConstraint,
    TurnstileService,
  ],
  exports: [JobOpeningService, CandidateService, InterviewService],
})
export class RecruitmentModule {}
