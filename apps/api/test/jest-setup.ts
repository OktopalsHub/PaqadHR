process.env.R2_ACCOUNT_ID ??= 'local-account-id';
process.env.R2_ACCESS_KEY_ID ??= 'local-access-key-id';
process.env.R2_SECRET_ACCESS_KEY ??= 'local-secret-access-key';
process.env.R2_BUCKET_NAME ??= 'local-bucket';
process.env.R2_PUBLIC_ID ??= 'local-public-id';
process.env.ACCESS_SECRET ??= 'ci-access-secret-must-be-at-least-32-chars-long';
process.env.REFRESH_SECRET ??= 'ci-refresh-secret-must-be-at-least-32-chars-long';
process.env.ENCRYPTION_KEY ??= '01234567890123456789012345678901';
process.env.NODE_ENV = 'test';
process.env.PORT ??= '9001';
process.env.BASE_URL ??= 'http://localhost:9001';
process.env.FRONTEND_URL ??= 'http://localhost:3000';
process.env.TRUSTED_ORIGINS ??= 'http://localhost:3000';
process.env.GOOGLE_CLIENT_ID ??= 'ci-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ??= 'ci-google-client-secret';
process.env.GOOGLE_CALLBACK_URL ??= 'http://localhost:9001/api/v1/auth/google/callback';

// Clear billing credentials to keep sandbox isolated
process.env.NOMBA_CLIENT_ID = '';
process.env.NOMBA_CLIENT_SECRET = '';
process.env.NOMBA_PARENT_ACCOUNT_ID = '';

import { DataSource } from 'typeorm';

jest.spyOn(DataSource.prototype, 'initialize').mockImplementation(async function (
  this: DataSource,
) {
  return this;
});
jest.spyOn(DataSource.prototype, 'destroy').mockResolvedValue(undefined);
