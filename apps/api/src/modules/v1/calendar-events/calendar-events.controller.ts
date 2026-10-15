import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { CalendarEventsService } from './calendar-events.service';
import { CreateCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar-event.dto';

@ApiTags('Calendar Events')
@Controller('tenants/:tenantId/calendar-events')
@UseGuards(TenantMemberGuard)
export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calendarEventsService.list(tenantId, from, to);
  }

  @Post()
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.ADMIN, TenantMemberRole.OWNER)
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateCalendarEventDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.calendarEventsService.create(tenantId, member.id, dto);
  }

  @Patch(':eventId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.ADMIN, TenantMemberRole.OWNER)
  async update(
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateCalendarEventDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.calendarEventsService.update(tenantId, eventId, dto, member.id);
  }

  @Delete(':eventId')
  @HttpCode(204)
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.ADMIN, TenantMemberRole.OWNER)
  async remove(
    @Param('tenantId') tenantId: string,
    @Param('eventId') eventId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    await this.calendarEventsService.remove(tenantId, eventId, member.id);
  }
}
