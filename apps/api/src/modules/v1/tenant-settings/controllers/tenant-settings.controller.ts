import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentTenantMember, TenantId } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { MemberContext } from 'src/common/interfaces';
import type { TenantSettingsData } from 'src/common/interfaces/tenant-settings-data.interface';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { MemberPointsService } from '../../shoutouts/services/member-points.service';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { TenantsService } from '../../tenants/tenants.service';
import {
  AssignPointsDto,
  HolidayDto,
  HolidaySettingsDto,
  UpdateTenantSettingsDto,
} from '../dto/tenant-settings.dto';
import { defaultHolidaySettings, HolidayService } from '../services/holiday.service';
import { TenantSettingsService } from '../services/tenant-settings.service';
import { TenantSettingsInitializationService } from '../services/tenant-settings-initialization.service';
@ApiTags('Tenant Settings')
@Controller('tenants/:tenantId/settings')
@UseGuards(TenantMemberGuard)
export class TenantSettingsController {
  constructor(
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly tenantSettingsInitializationService: TenantSettingsInitializationService,
    private readonly tenantsService: TenantsService,
    private readonly memberPointsService: MemberPointsService,
    private readonly holidayService: HolidayService,
  ) {}
  @Get()
  async getTenantSettings(@TenantId() tenantId: string) {
    return this.tenantSettingsService.getTenantSettings(tenantId);
  }
  @Patch()
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async updateTenantSettings(
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateTenantSettingsDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.tenantSettingsService.updateTenantSettings(tenantId, updateDto, member.id);
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
  @Get('members-points')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getTenantMembersWithPoints(@TenantId() tenantId: string) {
    return this.memberPointsService.listMembersWithPoints(tenantId);
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
      customSettings?: unknown;
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
      customSettings?: unknown;
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

  @Get('holidays')
  async getHolidaySettings(@TenantId() tenantId: string, @Req() req: Request) {
    const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const ip = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, req.ip);
    const suggestedCountryCode = await GeoLocationHelper.getCountryCode(ip);
    return {
      ...settings.settings.holidays,
      suggestedCountryCode: suggestedCountryCode || undefined,
    };
  }
  @Get('holidays/countries')
  getSupportedCountries() {
    return {
      countries: this.holidayService.getSupportedCountriesWithNames(),
    };
  }
  @Get('holidays/calendar/:year')
  async getHolidaysForYear(@TenantId() tenantId: string, @Param('year') year: string) {
    const [settings, tenant] = await Promise.all([
      this.tenantSettingsService.getTenantSettings(tenantId),
      this.tenantsService.getTenant(tenantId),
    ]);
    const holidaySettings = {
      ...defaultHolidaySettings(),
      ...settings.settings.holidays,
    };
    const countryCode = holidaySettings.countryCode || tenant.countryCode || '';
    return await this.holidayService.getHolidaysForYear(
      parseInt(year, 10),
      countryCode,
      holidaySettings,
    );
  }
  @Get('holidays/:countryCode')
  async getCountryHolidays(@Param('countryCode') countryCode: string) {
    const holidays = await this.holidayService.getCountryHolidaysFromProvider(countryCode);
    return {
      countryCode: countryCode.toUpperCase(),
      holidays,
    };
  }
  @Patch('holidays')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async updateHolidaySettings(
    @TenantId() tenantId: string,
    @Body() holidaySettings: HolidaySettingsDto,
  ) {
    return this.tenantSettingsService.updateTenantSettings(tenantId, {
      holidays: holidaySettings,
    });
  }
  @Post('holidays/custom')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async addCustomHoliday(
    @TenantId() tenantId: string,
    @Body() holidayData: Omit<HolidayDto, 'id'>,
  ) {
    const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const currentHolidays = settings.settings.holidays?.customHolidays || [];
    const newHoliday: HolidayDto = {
      ...holidayData,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    const updatedHolidays: HolidayDto[] = [...currentHolidays, newHoliday];
    return this.tenantSettingsService.updateTenantSettings(tenantId, {
      holidays: {
        ...settings.settings.holidays,
        customHolidays: updatedHolidays,
      },
    });
  }
  @Delete('holidays/custom/:holidayId')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async removeCustomHoliday(@TenantId() tenantId: string, @Param('holidayId') holidayId: string) {
    const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
    const currentHolidays = settings.settings.holidays?.customHolidays || [];
    const updatedHolidays = currentHolidays.filter((h) => h.id !== holidayId);
    return this.tenantSettingsService.updateTenantSettings(tenantId, {
      holidays: {
        ...settings.settings.holidays,
        customHolidays: updatedHolidays,
      },
    });
  }
}
