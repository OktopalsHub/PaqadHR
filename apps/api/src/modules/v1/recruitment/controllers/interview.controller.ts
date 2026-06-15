import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, RequireFeatures } from 'src/common/decorators';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { FeatureAccessGuard } from 'src/common/guards/feature-access.guard';
import type { InterviewFilters, MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import type { CreateInterviewDto } from '../dto/interview.dto';
import type { UpdateInterviewDto } from '../dto/update-interview.dto';
import { InterviewService } from '../services/interview.service';

@ApiTags('Interviews')
@UseGuards(TenantMemberGuard, FeatureAccessGuard)
@RequireFeatures(FeatureAccess.RECRUITMENT)
@Controller('tenants/:tenantId/interviews')
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}
  @Post() scheduleInterview(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateInterviewDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.interviewService.createInterview(tenantId, member.id, dto);
  }
  @Get() getInterviews(
    @Param('tenantId') tenantId: string,
    @Query() filters: InterviewFilters,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.interviewService.getInterviews(tenantId, member.id, filters);
  }
  @Get('upcoming') getUpcomingInterviews(
    @Param('tenantId') tenantId: string,
    @Query('days', ParseIntPipe) days = 7,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.interviewService.getUpcomingInterviews(tenantId, member.id, days);
  }
  @Get('today') getTodaysInterviews(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.interviewService.getTodaysInterviews(tenantId, member.id);
  }
  @Get('statistics') getInterviewStatistics(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.interviewService.getInterviewStatistics(
      tenantId,
      member.id,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }
  @Get(':id') getInterview(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) interviewId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.interviewService.getInterview(interviewId, tenantId, member.id);
  }
  @Patch(':id') updateInterview(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) interviewId: string,
    @Body() dto: UpdateInterviewDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.interviewService.updateInterview(interviewId, tenantId, member.id, dto);
  }
  @Delete(':id')
  async deleteInterview(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) interviewId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    await this.interviewService.deleteInterview(interviewId, tenantId, member.id);
    return { message: 'Interview deleted successfully' };
  }
}
