import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IntegrationType } from 'src/common/enums';
import type { PlatformUser } from '../entities/platform-user.entity';
import type { IntegrationConfig, IntegrationSyncStatus } from '../integration.types';
import { PlatformIntegrationService } from './platform-integration.service';
import { UserSyncService } from './user-sync.service';
@Injectable()
export class IntegrationSetupService {
  private readonly logger = new Logger(IntegrationSetupService.name);
  constructor(
    private readonly platformIntegrationService: PlatformIntegrationService,
    private readonly userSyncService: UserSyncService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  async setupIntegration(
    tenantId: string,
    type: IntegrationType,
    config: IntegrationConfig,
    memberId: string,
  ) {
    this.logger.log(`Setting up ${type} integration for tenant: ${tenantId}`);
    try {
      const integration = await this.platformIntegrationService.createIntegration(
        tenantId,
        type,
        config,
        memberId,
      );
      this.logger.log(`Integration created: ${integration.id}`);
      this.eventEmitter.emit('integration.connected', {
        integrationId: integration.id,
        tenantId,
        platform: type,
      });
      setTimeout(async () => {
        try {
          const syncStatus = await this.userSyncService.getSyncStatus(integration.id);
          this.logger.log(`Initial sync completed:`, syncStatus);
        } catch (error) {
          this.logger.error('Error getting sync status:', error);
        }
      }, 2000);
      return {
        integration,
        message: 'Integration setup completed. User sync is running in the background.',
      };
    } catch (error) {
      this.logger.error(`Failed to setup ${type} integration:`, error);
      throw error;
    }
  }
  async triggerUserSync(integrationId: string, tenantId: string) {
    this.logger.log(`Manually triggering user sync for integration: ${integrationId}`);
    try {
      const syncResults = await this.userSyncService.syncAllUsers(integrationId, tenantId);
      this.logger.log(`Manual sync completed:`, syncResults);
      return {
        success: true,
        results: syncResults,
        message: `Sync completed: ${syncResults.matched} matched, ${syncResults.unmatched} unmatched`,
      };
    } catch (error) {
      this.logger.error('Manual sync failed:', error);
      throw error;
    }
  }
  async getIntegrationStatus(integrationId: string) {
    try {
      const [syncStatus, unmatchedUsers] = await Promise.all([
        this.userSyncService.getSyncStatus(integrationId),
        this.userSyncService.getUnmatchedUsers(integrationId),
      ]);
      return {
        syncStatus,
        unmatchedUsers: unmatchedUsers.slice(0, 10),
        recommendations: this.generateRecommendations(syncStatus, unmatchedUsers),
      };
    } catch (error) {
      this.logger.error('Error getting integration status:', error);
      throw error;
    }
  }
  private generateRecommendations(
    syncStatus: IntegrationSyncStatus,
    unmatchedUsers: PlatformUser[],
  ) {
    const recommendations: Array<{
      type: string;
      message: string;
      action: string;
    }> = [];
    if (syncStatus.matchRate < 50) {
      recommendations.push({
        type: 'warning',
        message: 'Low match rate detected. Consider manual user matching or email verification.',
        action: 'review_unmatched_users',
      });
    }
    if (unmatchedUsers.length > 0) {
      recommendations.push({
        type: 'info',
        message: `${unmatchedUsers.length} unmatched users found. You can invite them or match manually.`,
        action: 'bulk_invite_or_match',
      });
    }
    if (syncStatus.matchRate > 80) {
      recommendations.push({
        type: 'success',
        message: 'Great! Most users are successfully matched.',
        action: 'none',
      });
    }
    return recommendations;
  }
}
