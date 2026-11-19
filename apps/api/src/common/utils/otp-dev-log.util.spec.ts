import { Logger } from '@nestjs/common';

import { isOtpConsoleLoggingEnabled, logOtpForLocalDevelopment } from './otp-dev-log.util';

describe('local OTP logging', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('logs the code in development and stays silent in production', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    process.env.NODE_ENV = 'development';
    logOtpForLocalDevelopment('dev@example.com', '123456', 'Password change');
    expect(log).toHaveBeenCalledTimes(1);

    log.mockClear();
    process.env.NODE_ENV = 'production';
    logOtpForLocalDevelopment('dev@example.com', '123456', 'Password change');
    expect(log).not.toHaveBeenCalled();
  });

  it('treats an unset NODE_ENV as development', () => {
    delete process.env.NODE_ENV;
    expect(isOtpConsoleLoggingEnabled()).toBe(true);
  });
});
