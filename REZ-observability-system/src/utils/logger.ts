const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;
const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  let metaStr = '';
  if (args.length > 0) {
    metaStr = ' ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  }
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}
export const logger: Record<string, (message: string, ...args: unknown[]) => void> = {
  error(message: string, ...args: unknown[]): void {
    if (LOG_LEVELS.error <= LOG_LEVELS[currentLevel]) console.error(formatMessage('error', message, ...args));
  },
  warn(message: string, ...args: unknown[]): void {
    if (LOG_LEVELS.warn <= LOG_LEVELS[currentLevel]) console.warn(formatMessage('warn', message, ...args));
  },
  info(message: string, ...args: unknown[]): void {
    if (LOG_LEVELS.info <= LOG_LEVELS[currentLevel]) console.log(formatMessage('info', message, ...args));
  },
  debug(message: string, ...args: unknown[]): void {
    if (LOG_LEVELS.debug <= LOG_LEVELS[currentLevel]) console.log(formatMessage('debug', message, ...args));
  },
};

export default logger;
