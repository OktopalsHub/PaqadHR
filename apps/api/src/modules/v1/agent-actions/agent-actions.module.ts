import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentApiKeyMemberGuard } from 'src/common/guards/agent-api-key-member.guard';
import { ManagerAccessModule } from 'src/common/modules/manager-access.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { ActivitiesModule } from '../activities/activities.module';
import { LeaveModule } from '../leave/leave.module';
import { PayrollModule } from '../payroll/payroll.module';
import { ShoutoutsModule } from '../shoutouts/shoutouts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { AgentGatewayController } from './agent-gateway.controller';
import { AgentActionsController } from './agent-actions.controller';
import { AgentActionIdempotency } from './entities/agent-action-idempotency.entity';
import { PendingAgentAction } from './entities/pending-agent-action.entity';
import { AgentActionsService } from './services/agent-actions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PendingAgentAction, AgentActionIdempotency, Tenant]),
    ManagerAccessModule,
    SubscriptionsModule,
    TenantMembersModule,
    LeaveModule,
    ShoutoutsModule,
    PayrollModule,
    ActivitiesModule,
  ],
  controllers: [AgentActionsController, AgentGatewayController],
  providers: [AgentActionsService, AgentApiKeyMemberGuard],
  exports: [AgentActionsService],
})
export class AgentActionsModule {}
