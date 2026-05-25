export const logger = {
  info: (msg: string, meta?) => console.log(JSON.stringify({ level: 'info', msg, meta, ts: new Date().toISOString() })),
  error: (msg: string, meta?) => console.error(JSON.stringify({ level: 'error', msg, meta, ts: new Date().toISOString() })),
  warn: (msg: string, meta?) => console.warn(JSON.stringify({ level: 'warn', msg, meta, ts: new Date().toISOString() })),
  debug: (msg: string, meta?) => console.debug(JSON.stringify({ level: 'debug', msg, meta, ts: new Date().toISOString() })),
};
