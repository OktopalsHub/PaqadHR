import type { Request } from 'express';
export interface IAuthenticatedUserRequest extends Request {
  auth: {
    principalId: string;
    email: string;
    role: string;
  };
}
