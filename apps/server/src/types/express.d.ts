import { User } from '@/modules/users/entities';
import { Request as ExpressRequest } from 'express';

declare module 'express' {
  interface Request extends ExpressRequest {
    user?: User;
  }
}

export {};
