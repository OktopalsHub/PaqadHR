import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { MarkNotificationsReadDto } from './mark-notifications-read.dto';

const check = (plain: object) =>
  validate(plainToInstance(MarkNotificationsReadDto, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const id = '123e4567-e89b-42d3-a456-426614174000';

describe('MarkNotificationsReadDto', () => {
  it('accepts uuid arrays', async () => {
    expect(await check({ notificationIds: [id] })).toHaveLength(0);
  });

  it('rejects empty, oversized, non-uuid, wrong type and unknown fields', async () => {
    for (const bad of [
      { notificationIds: [] },
      { notificationIds: Array.from({ length: 201 }, () => id) },
      { notificationIds: ['x'] },
      { notificationIds: id },
      { notificationIds: [id], extra: 1 },
    ]) {
      expect((await check(bad)).length).toBeGreaterThan(0);
    }
  });
});
