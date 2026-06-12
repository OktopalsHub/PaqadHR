import { CreateNotificationDto, CreateBulkNotificationDto } from '../dto/create-notification.dto';
import { Notification } from '../entities/notification.entity';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
  UseGuards,
  Req,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Observable, interval, map } from 'rxjs';
import { randomBytes } from 'crypto';
import { CurrentTenant } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/common/guards';
import { TenantGuard } from 'src/common/guards/tenant.guard';
import {
  IAuthenticatedUserRequest,
  TenantContext,
} from 'src/common/interfaces';
import { NotificationService } from '../services/notification.service';
import { SSENotificationService } from '../services/sse-notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly sseNotificationService: SSENotificationService,
  ) {}
  @Post()
  @ApiOperation({ summary: 'Create a notification' })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
  })
  async createNotification(
    @Body() createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    return this.notificationService.createNotification(createNotificationDto);
  }
  @Post('bulk')
  @ApiOperation({ summary: 'Create bulk notifications' })
  @ApiResponse({
    status: 201,
    description: 'Bulk notifications created successfully',
  })
  async createBulkNotifications(
    @Body() createBulkDto: CreateBulkNotificationDto,
  ): Promise<Notification[]> {
    return this.notificationService.createBulkNotifications(createBulkDto);
  }
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
    @Req() req: IAuthenticatedUserRequest,
    @CurrentTenant() tenant: TenantContext | undefined,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('unreadOnly') unreadOnly?: boolean,
  ): Promise<{ notifications: Notification[]; total: number }> {
    return this.notificationService.getUserNotifications(
      req.auth.principalId,
      tenant?.id,
      { limit, offset, unreadOnly },
    );
  }
  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
  })
  async getUnreadCount(
    @Req() req: IAuthenticatedUserRequest,
    @CurrentTenant() tenant: TenantContext | undefined,
  ): Promise<{ count: number }> {
    const count = await this.notificationService.getUnreadCount(
      req.auth.principalId,
      tenant?.id,
    );
    return { count };
  }
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(
    @Param('id') id: string,
    @Req() req: IAuthenticatedUserRequest,
  ): Promise<{ success: boolean }> {
    await this.notificationService.markAsRead(id, req.auth.principalId);
    return { success: true };
  }
  @Patch('read-multiple')
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  @ApiResponse({ status: 200, description: 'Notifications marked as read' })
  async markMultipleAsRead(
    @Body() body: { notificationIds: string[] },
    @Req() req: IAuthenticatedUserRequest,
  ): Promise<{ success: boolean }> {
    await this.notificationService.markMultipleAsRead(
      body.notificationIds,
      req.auth.principalId,
    );
    return { success: true };
  }
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(
    @Req() req: IAuthenticatedUserRequest,
    @CurrentTenant() tenant: TenantContext | undefined,
  ): Promise<{ success: boolean }> {
    await this.notificationService.markAllAsRead(
      req.auth.principalId,
      tenant?.id,
    );
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
    @Req() req: IAuthenticatedUserRequest,
  ): Promise<{ success: boolean }> {
    await this.notificationService.deleteNotification(id, req.auth.principalId);
    return { success: true };
  }
  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream for real-time notifications' })
  @ApiResponse({ status: 200, description: 'SSE stream established' })
  sseStream(
    @Req() req: IAuthenticatedUserRequest,
    @CurrentTenant() tenant: TenantContext | undefined,
  ): Observable<MessageEvent> {
    const userId = req.auth.principalId;
    const connectionId = `${userId}-${Date.now()}-${randomBytes(8).toString('hex')}`;
    this.sseNotificationService.registerConnection(
      connectionId,
      userId,
      tenant?.id,
    );
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
