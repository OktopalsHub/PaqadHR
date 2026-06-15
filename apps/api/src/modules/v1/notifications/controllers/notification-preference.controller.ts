import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/common/guards';
import type { MemberContext } from 'src/common/interfaces';
import type { NotificationPreferenceType } from '../../../../common/enums/notification-preference-type.enum';
import type { UpdatePreferenceDto } from '../../../../common/interfaces/update-preference-dto.interface';
import { HeaderTenantMemberGuard } from '../../tenant-members/guards/header-tenant-member.guard';
import type { NotificationPreference } from '../entities/notification-preference.entity';
import type { NotificationPreferenceService } from '../services/notification-preference.service';

@ApiTags('Notification Preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HeaderTenantMemberGuard)
@Controller('notification-preferences')
export class NotificationPreferenceController {
  constructor(private readonly preferenceService: NotificationPreferenceService) {}
  @Get()
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Preferences retrieved successfully',
  })
  async getUserPreferences(
    @CurrentTenantMember() member: MemberContext,
  ): Promise<NotificationPreference[]> {
    return this.preferenceService.getUserPreferences(member.id);
  }
  @Get('defaults')
  @ApiOperation({ summary: 'Get default notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Default preferences retrieved successfully',
  })
  async getDefaultPreferences(): Promise<
    Array<{ notificationType: string; defaultSettings: UpdatePreferenceDto }>
  > {
    return this.preferenceService.getDefaultPreferences();
  }
  @Get(':notificationType')
  @ApiOperation({ summary: 'Get specific notification preference' })
  @ApiResponse({
    status: 200,
    description: 'Preference retrieved successfully',
  })
  async getPreference(
    @Param('notificationType') notificationType: string,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<NotificationPreference | null> {
    return this.preferenceService.getPreference(
      member.id,
      notificationType as NotificationPreferenceType,
    );
  }
  @Patch(':notificationType')
  @ApiOperation({ summary: 'Update notification preference' })
  @ApiResponse({ status: 200, description: 'Preference updated successfully' })
  async updatePreference(
    @Param('notificationType') notificationType: string,
    @Body() updateDto: UpdatePreferenceDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<NotificationPreference> {
    return this.preferenceService.updatePreference(
      member.id,
      notificationType as NotificationPreferenceType,
      updateDto,
    );
  }
  @Patch()
  @ApiOperation({ summary: 'Update multiple notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated successfully' })
  async updateMultiplePreferences(
    @Body()
    body: {
      preferences: Array<{ notificationType: string } & UpdatePreferenceDto>;
    },
    @CurrentTenantMember() member: MemberContext,
  ): Promise<NotificationPreference[]> {
    const typedPreferences = body.preferences.map((pref) => ({
      ...pref,
      notificationType: pref.notificationType as NotificationPreferenceType,
    }));
    return this.preferenceService.updateMultiplePreferences(member.id, typedPreferences);
  }
  @Post('reset')
  @ApiOperation({ summary: 'Reset preferences to defaults' })
  @ApiResponse({ status: 200, description: 'Preferences reset successfully' })
  async resetToDefaults(
    @CurrentTenantMember() member: MemberContext,
  ): Promise<{ success: boolean }> {
    await this.preferenceService.resetToDefaults(member.id);
    return { success: true };
  }
}
