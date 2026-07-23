import {
  ErrorException,
  ErrorExceptionCode,
} from '@/common/exceptions/error.exception';
import { Injectable, Logger } from '@nestjs/common';
import { IJobHandler } from '../types/job.types';

@Injectable()
export class JobRegistryService {
  private readonly logger = new Logger(JobRegistryService.name);
  private readonly handlers = new Map<string, IJobHandler>();

  register(handler: IJobHandler) {
    if (this.handlers.has(handler.name)) {
      throw new Error(`Duplicate job handler registered: ${handler.name}`);
    }

    this.handlers.set(handler.name, handler);
    this.logger.log(`Registered job handler: ${handler.name}`);
  }

  get(name: string): IJobHandler {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new ErrorException(ErrorExceptionCode.JOB_HANDLER_NOT_FOUND);
    }
    return handler;
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  listNames(): string[] {
    return [...this.handlers.keys()].sort();
  }
}
