import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  SHOUTOUT_CREATED_EVENT,
  ShoutoutCreatedEventPayload,
} from '../events/shoutout.events';
import { ShoutoutAuditService } from '../services/shoutout-audit.service';

@Injectable()
export class ShoutoutAuditListener {
  constructor(private readonly shoutoutAuditService: ShoutoutAuditService) {}

  @OnEvent(SHOUTOUT_CREATED_EVENT)
  async handleShoutoutCreated(payload: ShoutoutCreatedEventPayload): Promise<void> {
    await this.shoutoutAuditService.logShoutoutCreated(payload);
  }
}
