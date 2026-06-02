type LogLevel = 'debug' | 'info' | 'warn' | 'error';
class Logger { private s: string; private readonly l: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
  constructor(s: string) { this.s = s; }
  private o(l: LogLevel, a: string, d?: Record<string, unknown>): void {
    const p = `[${new Date().toISOString()}] [${l.toUpperCase()}] [${this.s}]`;
    const m = Object.entries({ a, ...d }).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
    l === 'error' ? console.error(p, m) : l === 'warn' ? console.warn(p, m) : console.log(p, m);
  }
  debug(a: string, d?: Record<string, unknown>) { this.o('debug', a, d); }
  info(a: string, d?: Record<string, unknown>) { this.o('info', a, d); }
  warn(a: string, d?: Record<string, unknown>) { this.o('warn', a, d); }
  error(a: string, d?: Record<string, unknown>) { this.o('error', a, d); }
}
export function createLogger(s: string): Logger { return new Logger(s); }
