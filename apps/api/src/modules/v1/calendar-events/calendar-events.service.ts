import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitiesService } from '../activities/services/activities.service';
import type { CreateCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar-event.dto';
import { TenantCalendarEvent } from './entities/tenant-calendar-event.entity';

@Injectable()
export class CalendarEventsService {
  constructor(
    @InjectRepository(TenantCalendarEvent)
    private readonly repo: Repository<TenantCalendarEvent>,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async list(tenantId: string, from?: string, to?: string) {
    const qb = this.repo
      .createQueryBuilder('event')
      .where('event.tenantId = :tenantId', { tenantId });

    if (from) {
      qb.andWhere('event.endDate >= :from', { from });
    }
    if (to) {
      qb.andWhere('event.startDate <= :to', { to });
    }

    return qb.orderBy('event.startDate', 'ASC').getMany();
  }

  async create(tenantId: string, memberId: string, dto: CreateCalendarEventDto) {
    const allDay = dto.allDay ?? true;
    const event = this.repo.create({
      tenantId,
      createdBy: memberId,
      title: dto.title,
      description: dto.description,
      startDate: dto.startDate.slice(0, 10),
      endDate: dto.endDate.slice(0, 10),
      allDay,
      startTime: allDay ? null : (dto.startTime ?? null),
      endTime: allDay ? null : (dto.endTime ?? null),
      reminderMinutes: dto.reminderMinutes ?? null,
      type: dto.type ?? 'meeting',
    });
    const saved = await this.repo.save(event);

    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: memberId,
        action: 'calendar.event_created',
        resourceType: 'calendar_event',
        resourceId: saved.id,
        description: `Calendar event "${dto.title}" created`,
        metadata: { title: dto.title, type: dto.type },
      })
      .catch(() => {});

    return saved;
  }

  async update(
    tenantId: string,
    eventId: string,
    dto: UpdateCalendarEventDto,
    actorMemberId?: string,
  ) {
    const event = await this.repo.findOne({ where: { id: eventId, tenantId } });
    if (!event) throw new NotFoundException('Calendar event not found');

    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.startDate !== undefined) event.startDate = dto.startDate.slice(0, 10);
    if (dto.endDate !== undefined) event.endDate = dto.endDate.slice(0, 10);
    if (dto.allDay !== undefined) event.allDay = dto.allDay;
    if (dto.startTime !== undefined) event.startTime = dto.startTime;
    if (dto.endTime !== undefined) event.endTime = dto.endTime;
    if (dto.reminderMinutes !== undefined) event.reminderMinutes = dto.reminderMinutes;
    if (dto.type !== undefined) event.type = dto.type;

    if (event.allDay) {
      event.startTime = null;
      event.endTime = null;
    }

    if (
      dto.reminderMinutes !== undefined ||
      dto.startDate !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      dto.allDay !== undefined
    ) {
      event.reminderSentAt = null;
    }

    const saved = await this.repo.save(event);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'calendar.event_updated',
          resourceType: 'calendar_event',
          resourceId: eventId,
          description: `Calendar event updated`,
          metadata: { updatedFields: Object.keys(dto) },
        })
        .catch(() => {});
    }

    return saved;
  }

  async remove(tenantId: string, eventId: string, actorMemberId?: string) {
    const event = await this.repo.findOne({ where: { id: eventId, tenantId } });
    if (!event) throw new NotFoundException('Calendar event not found');
    await this.repo.remove(event);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'calendar.event_deleted',
          resourceType: 'calendar_event',
          resourceId: eventId,
          description: `Calendar event "${event.title}" deleted`,
          metadata: { title: event.title },
        })
        .catch(() => {});
    }
  }
}
