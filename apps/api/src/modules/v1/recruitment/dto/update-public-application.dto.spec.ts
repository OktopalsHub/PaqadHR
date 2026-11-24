import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdatePublicApplicationDto } from './update-public-application.dto';

const errorsFor = async (body: object) =>
  validate(plainToInstance(UpdatePublicApplicationDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('UpdatePublicApplicationDto', () => {
  it('accepts the applicant email with candidate fields', async () => {
    expect(await errorsFor({ email: 'a@b.com', phone: '+2348012345678' })).toHaveLength(0);
  });

  it.each([
    { phone: '+2348012345678' },
    { email: 'not-an-email' },
    { email: 'a@b.com', isAdmin: 1 },
  ])('rejects %j', async (body) => {
    expect((await errorsFor(body)).length).toBeGreaterThan(0);
  });
});
