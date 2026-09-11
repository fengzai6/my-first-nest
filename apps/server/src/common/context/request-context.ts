import { AsyncLocalStorage } from 'node:async_hooks';

export interface IRequestContext {
  requestId: string;
  startedAt: number;
  method: string;
  url: string;
  ip: string;
  userId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<IRequestContext>();
