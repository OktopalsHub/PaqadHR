import { Body, Controller, ForbiddenException, Headers, Post, Req, UseGuards, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthOnly, RateLimit, RateLimitPresets } from 'src/common/decorators';
import { AgentApiKeyMemberGuard } from 'src/common/guards/agent-api-key-member.guard';
import type { IAuthenticatedMemberRequest } from 'src/common/interfaces';
import { ExecuteAgentActionDto } from './dto/execute-agent-action.dto';
import { AgentActionsService } from './services/agent-actions.service';

@ApiTags('Agent Gateway')
@ApiBearerAuth('JWT-auth')
@Controller({ path: 'agent', version: VERSION_NEUTRAL })
@AuthOnly()
@UseGuards(AgentApiKeyMemberGuard)
export class AgentGatewayController {
  constructor(private readonly agentActionsService: AgentActionsService) {}

  @Post('actions')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @ApiOperation({
    summary: 'Execute a semantic agent action (tenant derived from API key)',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  executeAction(
    @Body() dto: ExecuteAgentActionDto,
    @Req() request: IAuthenticatedMemberRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const tenantId = request.auth?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('API key tenant context missing');
    }
    return this.agentActionsService.execute(tenantId, dto, request, idempotencyKey);
  }
}
