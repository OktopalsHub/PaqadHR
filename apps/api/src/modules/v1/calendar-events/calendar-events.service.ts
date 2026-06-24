import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreateCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar-event.dto';
import { TenantCalendarEvent } from './entities/tenant-calendar-event.entity';

@Injectable()
export class CalendarEventsService {
  constructor(
    @InjectRepository(TenantCalendarEvent)
    private readonly repo: Repository<TenantCalendarEvent>,
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
      startTime: allDay ? null : dto.startTime ?? null,
      endTime: allDay ? null : dto.endTime ?? null,
      reminderMinutes: dto.reminderMinutes ?? null,
      type: dto.type ?? 'meeting',
    });
    return this.repo.save(event);
  }

  async update(tenantId: string, eventId: string, dto: UpdateCalendarEventDto) {
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

    return this.repo.save(event);
  }

  async remove(tenantId: string, eventId: string) {
    const event = await this.repo.findOne({ where: { id: eventId, tenantId } });
    if (!event) throw new NotFoundException('Calendar event not found');
    await this.repo.remove(event);
  }
}
