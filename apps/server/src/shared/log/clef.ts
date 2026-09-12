import type { ILogEvent } from './interfaces/log.interface';

const formatLevel = (level: ILogEvent['level']) =>
  `${level.charAt(0).toUpperCase()}${level.slice(1)}`;

export const toClefLogEvent = (event: ILogEvent): Record<string, unknown> => {
  const result: Record<string, unknown> = {
    '@t': event.timestamp.toISOString(),
    '@l': formatLevel(event.level),
    '@m': event.message,
    // NOTE: 不用 CLEF 的 @i：Seq 把它当事件类型（Serilog 约定为消息模板哈希）归类同类事件，不是每条记录的唯一 ID。
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
