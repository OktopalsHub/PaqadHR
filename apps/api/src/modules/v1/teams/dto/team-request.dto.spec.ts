import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AssignTeamLeaderDto } from './assign-team-leader.dto';
import { GetTeamsQueryDto } from './get-teams-query.dto';

const check = (cls: new () => object, plain: object) =>
  validate(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true });

const id = '123e4567-e89b-42d3-a456-426614174000';

describe('AssignTeamLeaderDto', () => {
  it('accepts a uuid', async () => {
    expect(await check(AssignTeamLeaderDto, { memberId: id })).toHaveLength(0);
  });

  it('rejects missing, non-uuid and unknown fields', async () => {
    for (const bad of [{}, { memberId: 'x' }, { memberId: id, role: 'a' }]) {
      expect((await check(AssignTeamLeaderDto, bad)).length).toBeGreaterThan(0);
    }
  });
});

describe('GetTeamsQueryDto', () => {
  it('accepts empty and valid filters', async () => {
    expect(await check(GetTeamsQueryDto, {})).toHaveLength(0);
    expect(await check(GetTeamsQueryDto, { name: 'a', departmentId: id, leadId: id })).toHaveLength(
      0,
    );
  });

  it('rejects non-uuid ids, array values and unknown fields', async () => {
    for (const bad of [
      { departmentId: 'x' },
      { leadId: 'x' },
      { name: ['a', 'b'] },
      { tenantId: id },
    ]) {
      expect((await check(GetTeamsQueryDto, bad)).length).toBeGreaterThan(0);
    }
  });
});
