import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, TenantId } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import type { PartialTenantSettingsData } from 'src/common/interfaces/partial-tenant-settings-data.interface';
import type { TenantSettingsData } from 'src/common/interfaces/tenant-settings-data.interface';
import { MemberPointsService } from '../../shoutouts/services/member-points.service';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import {
  AssignPointsDto,
  CreateCustomHolidayDto,
  HolidaySettingsDto,
  UpdateTenantSettingsDto,
} from '../dto/tenant-settings.dto';
import { TenantSettingsService } from '../services/tenant-settings.service';
import { TenantSettingsInitializationService } from '../services/tenant-settings-initialization.service';
import { serializeTenantSettings } from './tenant-settings-serializer';

@ApiTags('Tenant Settings')
@Controller('tenants/:tenantId/settings')
@UseGuards(TenantMemberGuard)
export class SettingsWriteController {
  constructor(
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly tenantSettingsInitializationService: TenantSettingsInitializationService,
    private readonly memberPointsService: MemberPointsService,
  ) {}

  @Patch()
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async updateTenantSettings(
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateTenantSettingsDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    await this.tenantSettingsService.updateTenantSettings(tenantId, updateDto, member.id);
    return serializeTenantSettings(
      await this.tenantSettingsService.getTenantSettingsForDisplay(tenantId),
    );
  }

  @Post('assign-points')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async assignPointsToAllMembers(
    @TenantId() tenantId: string,
    @Body() assignPointsDto: AssignPointsDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.memberPointsService.bulkAssign(
      tenantId,
      assignPointsDto.points,
      assignPointsDto.reason,
      member.id,
    );
  }

  @Post('initialize')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async initializeTenantSettings(
    @TenantId() tenantId: string,
    @Body()
    initData: {
      companyName?: string;
      timezone?: string;
      currency?: string;
      language?: string;
      monthlyPointsAllowance?: number;
      enableNotifications?: boolean;
      customSettings?: PartialTenantSettingsData;
    },
  ) {
    const {
      companyName,
      timezone,
      currency,
      language,
      monthlyPointsAllowance,
      enableNotifications,
      customSettings,
    } = initData;
    if (companyName) {
      return this.tenantSettingsInitializationService.initializeTenantSettingsWithCompanyDefaults(
        tenantId,
        companyName,
        {
          timezone,
          currency,
          language,
          monthlyPointsAllowance,
          enableNotifications,
        },
      );
    } else {
      return this.tenantSettingsInitializationService.initializeTenantSettings(
        tenantId,
        customSettings || {},
      );
    }
  }

  @Post('initialize-workspace')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async initializeTenantWorkspace(
    @TenantId() tenantId: string,
    @Body()
    initData: {
      companyName?: string;
      timezone?: string;
      currency?: string;
      language?: string;
      monthlyPointsAllowance?: number;
      enableNotifications?: boolean;
      initializeMemberPoints?: boolean;
      initialPointsOverride?: number;
      customSettings?: PartialTenantSettingsData;
    },
  ) {
    const {
      companyName,
      timezone,
      currency,
      language,
      monthlyPointsAllowance,
      enableNotifications,
      initializeMemberPoints,
      initialPointsOverride,
      customSettings,
    } = initData;
    let settings: TenantSettingsData | Record<string, unknown>;
    if (companyName) {
      settings = {
        general: {
          companyName,
          timezone: timezone || 'UTC',
          currency: currency || 'USD',
          language: language || 'en',
        },
        points: {
          monthlyAllowance: monthlyPointsAllowance || 100,
        },
        notifications: {
          emailNotifications: enableNotifications ?? true,
        },
      };
    } else {
      settings = (customSettings || {}) as TenantSettingsData;
    }
    const result = await this.tenantSettingsInitializationService.initializeTenantWorkspace(
      tenantId,
      settings,
    );
    if (initializeMemberPoints) {
      const pointsResult = await this.memberPointsService.initializeAllMembers(
        tenantId,
        initialPointsOverride,
      );
      return { ...result, memberPoints: pointsResult };
    }
    return result;
  }

  @Patch('holidays')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async updateHolidaySettings(
    @TenantId() tenantId: string,
    @Body() holidaySettings: HolidaySettingsDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return serializeTenantSettings(
      await this.tenantSettingsService.updateTenantSettings(
        tenantId,
        { holidays: holidaySettings },
        member.id,
      ),
    );
  }

  @Post('holidays/custom')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async addCustomHoliday(
    @TenantId() tenantId: string,
    @Body() holidayData: CreateCustomHolidayDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const currentHolidays = settings.settings.holidays?.customHolidays || [];
    const newHoliday = {
      ...holidayData,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    const updatedHolidays = [...currentHolidays, newHoliday];
    return serializeTenantSettings(
      await this.tenantSettingsService.updateTenantSettings(
        tenantId,
        {
          holidays: {
            ...settings.settings.holidays,
            customHolidays: updatedHolidays,
          },
        },
        member.id,
      ),
    );
  }

  @Delete('holidays/custom/:holidayId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async removeCustomHoliday(
    @TenantId() tenantId: string,
    @Param('holidayId') holidayId: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const currentHolidays = settings.settings.holidays?.customHolidays || [];
    const updatedHolidays = currentHolidays.filter((h) => h.id !== holidayId);
    return serializeTenantSettings(
      await this.tenantSettingsService.updateTenantSettings(
        tenantId,
        {
          holidays: {
            ...settings.settings.holidays,
            customHolidays: updatedHolidays,
          },
        },
        member.id,
      ),
    );
  }
}
