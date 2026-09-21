import { LOG_LEVEL, type LogLevel } from './constants/log.constants';
import { toClefLogEvent } from './clef';
import type { ILogEvent } from './interfaces/log.interface';

interface IConsoleLogFormatOptions {
  pretty: boolean;
  color: boolean;
}

const ANSI = {
  RESET: '\u001b[0m',
  DIM: '\u001b[2m',
  RED: '\u001b[31m',
  YELLOW: '\u001b[33m',
  BLUE: '\u001b[34m',
  CYAN: '\u001b[36m',
} as const;

const LEVEL_COLORS: Record<LogLevel, string> = {
  [LOG_LEVEL.DEBUG]: ANSI.DIM,
  [LOG_LEVEL.INFO]: ANSI.BLUE,
  [LOG_LEVEL.WARN]: ANSI.YELLOW,
  [LOG_LEVEL.ERROR]: ANSI.RED,
  [LOG_LEVEL.FATAL]: ANSI.RED,
};

const colorize = (value: string, color: string, enabled: boolean): string =>
  enabled ? `${color}${value}${ANSI.RESET}` : value;

const toRelativePath = (value: string): string =>
  value.replaceAll(`${process.cwd()}/`, '');

const formatRequestLine = (event: ILogEvent): string | null => {
  const route = [event.method, event.url].filter(Boolean).join(' ');
  const result = [route, event.statusCode ? `-> ${event.statusCode}` : null]
    .filter(Boolean)
    .join(' ');
  const parts = [
    result,
    event.duration != null ? `in ${event.duration}ms` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return parts || null;
};

const formatMetadataLine = (event: ILogEvent): string => {
  const parts = [
    ['requestId', event.requestId],
    ['logId', event.id],
    ['userId', event.userId],
    ['ip', event.ip],
  ]
    .filter(([, value]) => value != null)
    .map(([name, value]) => `${name}=${value}`);

  return parts.join(' ');
};

export const formatConsoleLogEvent = (
  event: ILogEvent,
  options: IConsoleLogFormatOptions,
): string => {
  if (!options.pretty) {
    return JSON.stringify(toClefLogEvent(event));
  }

  const timestamp = event.timestamp.toISOString().replace('T', ' ');
  const level = event.level.toUpperCase();
  const lines = [
    `${colorize(`[${timestamp}]`, ANSI.DIM, options.color)} ${colorize(
      level,
      LEVEL_COLORS[event.level],
      options.color,
    )} ${colorize(`[${event.category}]`, ANSI.CYAN, options.color)} ${event.message}`,
  ];

  const requestLine = formatRequestLine(event);
  if (requestLine) {
    lines.push(`  ${requestLine}`);
  }

  const metadataLine = formatMetadataLine(event);
  if (metadataLine) {
    lines.push(`  ${metadataLine}`);
  }

  if (event.context) {
    lines.push(`  context: ${JSON.stringify(event.context)}`);
  }

  if (event.stack) {
    const stack = toRelativePath(event.stack);
    lines.push(
      `  stack:\n${stack
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n')}`,
    );
  }

  return lines.join('\n');
};
