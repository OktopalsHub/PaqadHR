import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { TenantId } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { MemberPointsService } from '../../shoutouts/services/member-points.service';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { TenantsService } from '../../tenants/tenants.service';
import { defaultHolidaySettings, HolidayService } from '../services/holiday.service';
import { TenantSettingsService } from '../services/tenant-settings.service';
import { serializeTenantSettings } from './tenant-settings-serializer';

@ApiTags('Tenant Settings')
@Controller('tenants/:tenantId/settings')
@UseGuards(TenantMemberGuard)
export class SettingsReadController {
  constructor(
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly tenantsService: TenantsService,
    private readonly memberPointsService: MemberPointsService,
    private readonly holidayService: HolidayService,
  ) {}

  @Get()
  async getTenantSettings(@TenantId() tenantId: string) {
    return serializeTenantSettings(
      await this.tenantSettingsService.getTenantSettingsForDisplay(tenantId),
    );
  }

  @Get('members-points')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getTenantMembersWithPoints(@TenantId() tenantId: string) {
    return this.memberPointsService.listMembersWithPoints(tenantId);
  }

  @Get('holidays')
  async getHolidaySettings(@TenantId() tenantId: string, @Req() req: Request) {
    const [settings, tenant] = await Promise.all([
      this.tenantSettingsService.getTenantSettings(tenantId),
      this.tenantsService.getTenant(tenantId),
    ]);
    const ip = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, req.ip);
    const suggestedCountryCode = await GeoLocationHelper.getCountryCode(ip);
    const effectiveCountryCode =
      settings.settings.holidays?.countryCode ||
      tenant.countryCode ||
      (suggestedCountryCode !== 'GLOBAL' ? suggestedCountryCode : undefined);

    return {
      ...settings.settings.holidays,
      countryCode: effectiveCountryCode,
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
    const countryCode =
      holidaySettings.countryCode ||
      tenant.countryCode ||
      GeoLocationHelper.toStoredCountryCode(tenant.createdBy?.countryCode) ||
      '';
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
}
