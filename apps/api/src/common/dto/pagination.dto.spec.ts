import { ValidationPipe } from '@nestjs/common';
import { PaginationDto } from './pagination.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

async function validate(query: Record<string, string>): Promise<PaginationDto> {
  const dto = await pipe.transform(query, { type: 'query', metatype: PaginationDto });
  return dto as PaginationDto;
}

/** The pipe rethrows validation failures as BadRequestException, so unwrap the message. */
async function validationMessage(query: Record<string, string>): Promise<string> {
  try {
    await validate(query);
  } catch (error) {
    const response = (error as { getResponse?: () => { message?: string[] } }).getResponse?.();
    const message = response?.message;
    return Array.isArray(message) ? message.join('; ') : String(message ?? error);
  }
  return '';
}

describe('PaginationDto.limit', () => {
  it('accepts limit=200, which the calendar requests', async () => {
    expect((await validate({ limit: '200' })).limit).toBe(200);
  });

  it('still rejects a limit above the cap', async () => {
    expect(await validationMessage({ limit: '201' })).toMatch(/must not be greater than 200/);
  });

  it('defaults to 10 when no limit is supplied', async () => {
    expect((await validate({})).limit).toBe(10);
  });

  it('rejects a non-positive limit', async () => {
    expect(await validationMessage({ limit: '0' })).toMatch(/must not be less than 1/);
  });
});
