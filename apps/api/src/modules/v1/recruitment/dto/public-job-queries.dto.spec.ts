import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { PublicLimitQueryDto, PublicSuggestionQueryDto } from './public-job-queries.dto';

const tenantId = '3f2b6f0e-6a4a-4d52-9d6c-2f6d0b6f8a11';
const bad = async <T extends object>(cls: new () => T, body: object) =>
  (await validate(plainToInstance(cls, body))).map((e) => e.property);

describe('public job query DTOs', () => {
  it('require a workspace id', async () => {
    expect(await bad(PublicLimitQueryDto, {})).toContain('tenantId');
    expect(await bad(PublicSuggestionQueryDto, { query: 'dev' })).toContain('tenantId');
  });

  it('bound the limit and the search text', async () => {
    expect(await bad(PublicLimitQueryDto, { tenantId, limit: '5' })).toEqual([]);
    expect(await bad(PublicLimitQueryDto, { tenantId, limit: '500' })).toContain('limit');
    expect(await bad(PublicSuggestionQueryDto, { tenantId, query: 'x'.repeat(101) })).toContain(
      'query',
    );
  });
});
