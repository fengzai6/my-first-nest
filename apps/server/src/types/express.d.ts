import type { User } from '@/modules/users/entities/user.entity';
import type { Request as ExpressRequest } from 'express';

export type AuthRequest = ExpressRequest & {
  user?: User;
};

declare module 'express' {
  interface Request {
    user?: User;
  }
}
