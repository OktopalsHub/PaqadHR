import { randomBytes } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  type MessageEvent,
  Param,
  Patch,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { interval, map, Observable } from 'rxjs';
import { CurrentTenant, CurrentTenantMember } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/common/guards';
import type {
  IAuthenticatedUserRequest,
  MemberContext,
  TenantContext,
} from 'src/common/interfaces';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import type { Notification } from '../entities/notification.entity';
import { NotificationService } from '../services/notification.service';
import { SSENotificationService } from '../services/sse-notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantMemberGuard)
@Controller('tenants/:tenantId/notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly sseNotificationService: SSENotificationService,
  ) {}
  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  async getUserNotifications(
    @CurrentTenantMember() member: MemberContext,
    @CurrentTenant() tenant: TenantContext | undefined,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('unreadOnly') unreadOnly?: boolean,
  ): Promise<{ notifications: Notification[]; total: number }> {
    return this.notificationService.getUserNotifications(member.id, tenant?.id, {
      limit,
      offset,
      unreadOnly,
    });
  }
  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
  })
  async getUnreadCount(
    @CurrentTenantMember() member: MemberContext,
    @CurrentTenant() tenant: TenantContext | undefined,
  ): Promise<{ count: number }> {
    const count = await this.notificationService.getUnreadCount(member.id, tenant?.id);
    return { count };
  }
  @Patch('read-multiple')
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  @ApiResponse({ status: 200, description: 'Notifications marked as read' })
  async markMultipleAsRead(
    @Body() body: { notificationIds: string[] },
    @CurrentTenantMember() member: MemberContext,
    @CurrentTenant() tenant: TenantContext | undefined,
  ): Promise<{ success: boolean }> {
    await this.notificationService.markMultipleAsRead(body.notificationIds, member.id, tenant?.id);
    return { success: true };
  }
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(
    @CurrentTenantMember() member: MemberContext,
    @CurrentTenant() tenant: TenantContext | undefined,
  ): Promise<{ success: boolean }> {
    await this.notificationService.markAllAsRead(member.id, tenant?.id);
    return { success: true };
  }
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentTenantMember() member: MemberContext,
    @CurrentTenant() tenant: TenantContext | undefined,
  ): Promise<{ success: boolean }> {
    await this.notificationService.markAsRead(id, member.id, tenant?.id);
    return { success: true };
  }
  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  async deleteNotification(
    @Param('id') id: string,
    @CurrentTenantMember() member: MemberContext,
    @CurrentTenant() tenant: TenantContext | undefined,
  ): Promise<{ success: boolean }> {
    await this.notificationService.deleteNotification(id, member.id, tenant?.id);
    return { success: true };
  }
  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream for real-time notifications' })
  @ApiResponse({ status: 200, description: 'SSE stream established' })
  sseStream(
    @Req() req: IAuthenticatedUserRequest,
    @CurrentTenantMember() member: MemberContext,
    @CurrentTenant() tenant: TenantContext | undefined,
  ): Observable<MessageEvent> {
    const memberId = member.id;
    const connectionId = `${memberId}-${Date.now()}-${randomBytes(8).toString('hex')}`;
    this.sseNotificationService.registerConnection(connectionId, memberId, tenant?.id);
    req.on('close', () => {
      this.sseNotificationService.unregisterConnection(connectionId);
    });
    const heartbeat$ = interval(30000).pipe(
      map(() => {
        this.sseNotificationService.pingConnection(connectionId);
        return {
          data: JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
          }),
        } as MessageEvent;
      }),
    );
    const notifications$ = this.sseNotificationService
      .getNotificationStream(connectionId)
      .pipe(map((data) => ({ data }) as MessageEvent));
    return new Observable((observer) => {
      const heartbeatSub = heartbeat$.subscribe(observer);
      const notificationSub = notifications$.subscribe(observer);
      return () => {
        heartbeatSub.unsubscribe();
        notificationSub.unsubscribe();
        this.sseNotificationService.unregisterConnection(connectionId);
      };
    });
  }
}
