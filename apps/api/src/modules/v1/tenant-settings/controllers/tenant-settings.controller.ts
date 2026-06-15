import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, TenantId } from 'src/common/decorators';
import type { MemberContext } from 'src/common/interfaces';
import type { MemberPointsService } from '../../shoutouts/services/member-points.service';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import type { TenantsService } from '../../tenants/tenants.service';
import type {
  AssignPointsDto,
  HolidayDto,
  HolidaySettingsDto,
  UpdateTenantSettingsDto,
} from '../dto/tenant-settings.dto';
import type { TenantSettingsService } from '../services/tenant-settings.service';
import type { TenantSettingsInitializationService } from '../services/tenant-settings-initialization.service';
@ApiTags('Tenant Settings')
@Controller('tenants/:tenantId/settings')
@UseGuards(TenantMemberGuard)
export class TenantSettingsController {
  constructor(
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly tenantSettingsInitializationService: TenantSettingsInitializationService,
    private readonly tenantsService: TenantsService,
    private readonly memberPointsService: MemberPointsService,
  ) {}
  @Get()
  async getTenantSettings(@TenantId() tenantId: string) {
    return this.tenantSettingsService.getTenantSettings(tenantId);
  }
  @Patch()
  async updateTenantSettings(
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateTenantSettingsDto,
  ) {
    return this.tenantSettingsService.updateTenantSettings(tenantId, updateDto);
  }
  @Post('assign-points')
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
  async getTenantMembersWithPoints(@TenantId() tenantId: string) {
    return this.memberPointsService.listMembersWithPoints(tenantId);
  }
  @Post('initialize')
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
    let settings;
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
      settings = customSettings || {};
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
  async getHolidaySettings(@TenantId() tenantId: string) {
    const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
    return settings.settings.holidays;
  }
  @Get('holidays/countries')
  async getSupportedCountries() {
    const { HolidayService } = await import('../services/holiday.service');
    const holidayService = new HolidayService();
    return {
      countries: holidayService.getSupportedCountries(),
    };
  }
  @Get('holidays/calendar/:year')
  async getHolidaysForYear(@TenantId() tenantId: string, @Param('year') year: string) {
    const [settings, tenant] = await Promise.all([
      this.tenantSettingsService.getTenantSettings(tenantId),
      this.tenantsService.getTenant(tenantId),
    ]);
    const { HolidayService } = await import('../services/holiday.service');
    const holidayService = new HolidayService();
    return holidayService.getHolidaysForYear(
      parseInt(year, 10),
      tenant.countryCode || '',
      settings.settings.holidays,
    );
  }
  @Get('holidays/:countryCode')
  async getCountryHolidays(@Param('countryCode') countryCode: string) {
    const { HolidayService } = await import('../services/holiday.service');
    const holidayService = new HolidayService();
    return {
      countryCode: countryCode.toUpperCase(),
      holidays: holidayService.getCountryHolidays(countryCode),
    };
  }
  @Patch('holidays')
  async updateHolidaySettings(
    @TenantId() tenantId: string,
    @Body() holidaySettings: HolidaySettingsDto,
  ) {
    return this.tenantSettingsService.updateTenantSettings(tenantId, {
      holidays: holidaySettings,
    });
  }
  @Post('holidays/custom')
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
