import { User } from '@/modules/users/entities';

declare namespace Express {
  interface Request {
    user?: User;
  }
}

export {};
