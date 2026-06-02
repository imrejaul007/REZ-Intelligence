const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = process.env.LOG_LEVEL || 'info';
function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}
export const logger = {
  error(message, error) {
    if (LOG_LEVELS.error <= LOG_LEVELS[currentLevel]) console.error(formatMessage('error', message, error));
  },
  warn(message, meta) {
    if (LOG_LEVELS.warn <= LOG_LEVELS[currentLevel]) console.warn(formatMessage('warn', message, meta));
  },
  info(message, meta) {
    if (LOG_LEVELS.info <= LOG_LEVELS[currentLevel]) console.log(formatMessage('info', message, meta));
  },
  debug(message, meta) {
    if (LOG_LEVELS.debug <= LOG_LEVELS[currentLevel]) console.log(formatMessage('debug', message, meta));
  },
};
