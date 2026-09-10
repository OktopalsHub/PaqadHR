import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ACTIVITY_QUEUE_EVENT } from '../activity.events';
import type { CreateActivityPayload } from '../interfaces/create-activity-payload.interface';
import { ActivitiesService } from '../services/activities.service';

@Injectable()
export class ActivityQueueListener {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @OnEvent(ACTIVITY_QUEUE_EVENT)
  handleQueue(payload: CreateActivityPayload): void {
    void this.activitiesService.queueActivity(payload);
  }
}
