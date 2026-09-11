import type { ILogEvent } from './interfaces/log.interface';

const formatLevel = (level: ILogEvent['level']) =>
  `${level.charAt(0).toUpperCase()}${level.slice(1)}`;

export const toClefLogEvent = (event: ILogEvent): Record<string, unknown> => {
  const result: Record<string, unknown> = {
    '@t': event.timestamp.toISOString(),
    '@l': formatLevel(event.level),
    '@m': event.message,
    logId: event.id,
    requestId: event.requestId,
    userId: event.userId,
    category: event.category,
    method: event.method,
    url: event.url,
    statusCode: event.statusCode,
    duration: event.duration,
    ip: event.ip,
    context: event.context,
  };

  if (event.stack) {
    result['@x'] = event.stack;
  }

  return result;
};
