const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;
const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
function formatMessage(level: LogLevel, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}
export const logger = {
  error(message: string, error?: unknown): void {
    if (LOG_LEVELS.error <= LOG_LEVELS[currentLevel]) console.error(formatMessage('error', message, error));
  },
  warn(message: string, meta?: unknown): void {
    if (LOG_LEVELS.warn <= LOG_LEVELS[currentLevel]) console.warn(formatMessage('warn', message, meta));
  },
  info(message: string, meta?: unknown): void {
    if (LOG_LEVELS.info <= LOG_LEVELS[currentLevel]) console.log(formatMessage('info', message, meta));
  },
  debug(message: string, meta?: unknown): void {
    if (LOG_LEVELS.debug <= LOG_LEVELS[currentLevel]) console.log(formatMessage('debug', message, meta));
  },
};
