import { User } from '@/modules/users/entities';
import 'express';

declare module 'express' {
  interface Request {
    user?: User;
  }
}

export {};
