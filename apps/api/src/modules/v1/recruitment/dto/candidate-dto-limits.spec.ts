import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdatePublicApplicationDto } from './update-public-application.dto';

const errorsFor = async (body: object) =>
  (await validate(plainToInstance(UpdatePublicApplicationDto, { email: 'a@b.co', ...body })))
    .map((e) => e.property)
    .sort();

describe('public application update limits', () => {
  it('accepts normal values and accented real file names', async () => {
    expect(
      await errorsFor({
        phone: '+2348012345678',
        linkedinUrl: 'https://linkedin.com/in/ada',
        resumeFilename: 'José_CV & notes_1731668445123.pdf',
      }),
    ).toEqual([]);
  });

  it('rejects path tricks, junk urls and oversize text', async () => {
    expect(await errorsFor({ resumeFilename: '../other/secret.pdf' })).toContain('resumeFilename');
    expect(await errorsFor({ resumeFilename: 'a/b.pdf' })).toContain('resumeFilename');
    expect(await errorsFor({ githubUrl: 'javascript:alert(1)' })).toContain('githubUrl');
    expect(await errorsFor({ skills: 'x'.repeat(2001) })).toContain('skills');
    expect(await errorsFor({ phone: '1'.repeat(31) })).toContain('phone');
  });
});
