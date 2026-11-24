import 'reflect-metadata';

import { ClassSerializerInterceptor } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';

import { Account } from '../../modules/v1/auth/entities/account.entity';
import { User } from '../../modules/v1/users/entities/user.entity';
import { SERIALIZER_PROVIDER } from './serializer.provider';

const run = async (value: unknown) => {
  const interceptor = new ClassSerializerInterceptor(new Reflector());
  const context = { getHandler: () => run, getClass: () => User } as never;
  const result$ = await interceptor.intercept(context, { handle: () => of(value) });
  return JSON.parse(JSON.stringify(await lastValueFrom(result$)));
};

describe('global serializer', () => {
  it('registers ClassSerializerInterceptor as a global interceptor', () => {
    expect(SERIALIZER_PROVIDER).toEqual({
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    });
  });

  it('never serialises a user password', async () => {
    const user = Object.assign(new User(), { id: 'u1', email: 'a@b.com', password: 'hash-secret' });
    const output = await run(user);
    expect(output.email).toBe('a@b.com');
    expect(JSON.stringify(output)).not.toContain('hash-secret');
  });

  it('never serialises an account password, including nested under a user', async () => {
    const account = Object.assign(new Account(), { id: 'a1', password: 'account-secret' });
    const user = Object.assign(new User(), { id: 'u1', password: 'hash-secret' });
    const output = await run({ user, accounts: [account] });
    expect(JSON.stringify(output)).not.toContain('secret');
  });

  it('leaves plain objects and arrays unchanged', async () => {
    expect(await run({ a: 1, list: [1, 2] })).toEqual({ a: 1, list: [1, 2] });
  });
});
