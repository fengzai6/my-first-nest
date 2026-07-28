import { HttpStatus } from '@nestjs/common';
import { ExceptionInfo } from './base.exception';

export const JobExceptionCode = {
  JOB_NOT_FOUND: '15401',
  JOB_HANDLER_NOT_FOUND: '15402',
  JOB_NOT_CANCELLABLE: '15403',
  JOB_REDIS_REQUIRED: '15501',
} as const;

export type JobExceptionCode =
  (typeof JobExceptionCode)[keyof typeof JobExceptionCode];

export const JobExceptionMap: Record<JobExceptionCode, ExceptionInfo> = {
  [JobExceptionCode.JOB_NOT_FOUND]: {
    message: '任务不存在',
    status: HttpStatus.NOT_FOUND,
    code: JobExceptionCode.JOB_NOT_FOUND,
  },
  [JobExceptionCode.JOB_HANDLER_NOT_FOUND]: {
    message: '未知的任务处理器',
    status: HttpStatus.BAD_REQUEST,
    code: JobExceptionCode.JOB_HANDLER_NOT_FOUND,
  },
  [JobExceptionCode.JOB_NOT_CANCELLABLE]: {
    message: '当前状态的任务不可取消',
    status: HttpStatus.CONFLICT,
    code: JobExceptionCode.JOB_NOT_CANCELLABLE,
  },
  [JobExceptionCode.JOB_REDIS_REQUIRED]: {
    message: '任务系统需要 Redis，请配置 REDIS_URL 或 REDIS_HOST',
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: JobExceptionCode.JOB_REDIS_REQUIRED,
  },
};
