/**
 * REZ Feedback Collector - Logger
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

function log(level, msg, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = JSON.stringify({
    timestamp,
    level,
    msg,
    ...data,
    service: 'feedback-collector'
  });

  if (level === 'error') {
    console.error(logEntry);
  } else if (level === 'warn') {
    console.warn(logEntry);
  } else {
    console.log(logEntry);
  }
}

const logger = {
  error: (msg, data) => log('error', msg, data),
  warn: (msg, data) => log('warn', msg, data),
  info: (msg, data) => log('info', msg, data),
  debug: (msg, data) => {
    if (levels[LOG_LEVEL] >= levels.debug) {
      log('debug', msg, data);
    }
  }
};

module.exports = logger;
