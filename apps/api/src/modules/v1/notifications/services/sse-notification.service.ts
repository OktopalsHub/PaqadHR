import { Injectable, NotFoundException } from '@nestjs/common';
import { type Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type { SSENotificationData } from '../../../../common/interfaces/ssenotification-data.interface';

interface SSEConnection {
  userId: string;
  tenantId?: string;
  connectionId: string;
  lastPing: Date;
}
@Injectable()
export class SSENotificationService {
  private readonly notificationSubject = new Subject<SSENotificationData>();
  private readonly connections = new Map<string, SSEConnection>();
  private readonly userConnections = new Map<string, Set<string>>();
  constructor() {
    setInterval(() => this.cleanupStaleConnections(), 5 * 60 * 1000);
  }
  registerConnection(connectionId: string, userId: string, tenantId?: string): void {
    const connection: SSEConnection = {
      userId,
      tenantId,
      connectionId,
      lastPing: new Date(),
    };
    this.connections.set(connectionId, connection);
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);
    if (process.env.LOG_LEVEL !== 'error') {
    }
  }
  unregisterConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const userConnections = this.userConnections.get(connection.userId);
      if (userConnections) {
        userConnections.delete(connectionId);
        if (userConnections.size === 0) {
          this.userConnections.delete(connection.userId);
        }
      }
      this.connections.delete(connectionId);
      if (process.env.LOG_LEVEL !== 'error') {
      }
    }
  }
  pingConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastPing = new Date();
    }
  }
  getNotificationStream(connectionId: string): Observable<string> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new NotFoundException('Connection not found');
    }
    return this.notificationSubject.pipe(
      filter((notification) => this.shouldReceiveNotification(notification, connection)),
      map((notification) => this.formatSSEMessage(notification)),
    );
  }
  sendToUser(
    userId: string,
    notification: Omit<SSENotificationData, 'recipientId' | 'timestamp'>,
  ): void {
    const notificationData: SSENotificationData = {
      ...notification,
      recipientId: userId,
      timestamp: new Date(),
    };
    this.notificationSubject.next(notificationData);
    if (process.env.LOG_LEVEL !== 'error') {
    }
  }
  sendToTenant(
    tenantId: string,
    notification: Omit<SSENotificationData, 'tenantId' | 'timestamp'>,
  ): void {
    const notificationData: SSENotificationData = {
      ...notification,
      tenantId,
      timestamp: new Date(),
    };
    this.notificationSubject.next(notificationData);
    if (process.env.LOG_LEVEL !== 'error') {
    }
  }
  sendSystemNotification(notification: Omit<SSENotificationData, 'timestamp'>): void {
    const notificationData: SSENotificationData = {
      ...notification,
      timestamp: new Date(),
    };
    this.notificationSubject.next(notificationData);
    if (process.env.LOG_LEVEL !== 'error') {
    }
  }
  getActiveConnectionsCount(): number {
    return this.connections.size;
  }
  getUserConnectionsCount(userId: string): number {
    return this.userConnections.get(userId)?.size || 0;
  }
  getConnectionsInfo(): Array<{
    connectionId: string;
    userId: string;
    tenantId?: string;
    lastPing: Date;
  }> {
    return Array.from(this.connections.values()).map((conn) => ({
      connectionId: conn.connectionId,
      userId: conn.userId,
      tenantId: conn.tenantId,
      lastPing: conn.lastPing,
    }));
  }
  private shouldReceiveNotification(
    notification: SSENotificationData,
    connection: SSEConnection,
  ): boolean {
    if (!notification.tenantId && !notification.recipientId) {
      return true;
    }
    if (notification.recipientId && notification.recipientId === connection.userId) {
      return true;
    }
    if (
      notification.tenantId &&
      notification.tenantId === connection.tenantId &&
      !notification.recipientId
    ) {
      return true;
    }
    return false;
  }
  private formatSSEMessage(notification: SSENotificationData): string {
    const data = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      actionData: notification.actionData,
      timestamp: notification.timestamp.toISOString(),
    };
    return `data: ${JSON.stringify(data)}\n\n`;
  }
  private cleanupStaleConnections(): void {
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
    const staleConnections: string[] = [];
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.lastPing < staleThreshold) {
        staleConnections.push(connectionId);
      }
    }
    staleConnections.forEach((connectionId) => {
      this.unregisterConnection(connectionId);
    });
    if (staleConnections.length > 0) {
      if (process.env.LOG_LEVEL !== 'error') {
      }
    }
  }
}
