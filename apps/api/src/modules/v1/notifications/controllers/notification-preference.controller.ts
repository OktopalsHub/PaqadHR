import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/common/guards';
import type { MemberContext } from 'src/common/interfaces';
import type { NotificationPreferenceType } from '../../../../common/enums/notification-preference-type.enum';
import { HeaderTenantMemberGuard } from '../../tenant-members/guards/header-tenant-member.guard';
import { UpdatePreferenceDto } from '../dto/update-preference.dto';
import type { NotificationPreference } from '../entities/notification-preference.entity';
import { NotificationPreferenceService } from '../services/notification-preference.service';

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
    @Param('notificationType') notificationType: NotificationPreferenceType,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<NotificationPreference | null> {
    return this.preferenceService.getPreference(member.id, notificationType);
  }
  @Patch(':notificationType')
  @ApiOperation({ summary: 'Update notification preference' })
  @ApiResponse({ status: 200, description: 'Preference updated successfully' })
  async updatePreference(
    @Param('notificationType') notificationType: NotificationPreferenceType,
    @Body() updateDto: UpdatePreferenceDto,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<NotificationPreference> {
    return this.preferenceService.updatePreference(member.id, notificationType, updateDto);
  }
  @Patch()
  @ApiOperation({ summary: 'Update multiple notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated successfully' })
  async updateMultiplePreferences(
    @Body('preferences') preferences: Array<
      { notificationType: NotificationPreferenceType } & UpdatePreferenceDto
    >,
    @CurrentTenantMember() member: MemberContext,
  ): Promise<NotificationPreference[]> {
    return this.preferenceService.updateMultiplePreferences(member.id, preferences);
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
