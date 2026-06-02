import * as Sentry from '@sentry/node';

export interface LogContext {
  [key: string]: any;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface RedactingLoggerConfig {
  serviceName: string;
  environment: string;
  redactionPatterns?: RegExp[];
  sentryDsn?: string;
}

export class RedactingLogger {
  private redactionPatterns: RegExp[];
  private serviceName: string;

  constructor(config: RedactingLoggerConfig) {
    this.serviceName = config.serviceName;
    this.redactionPatterns = config.redactionPatterns || this.getDefaultPatterns();

    if (config.sentryDsn) {
      Sentry.init({
        dsn: config.sentryDsn,
        environment: config.environment,
        tracesSampleRate: 1.0,
      });
    }
  }

  private getDefaultPatterns(): RegExp[] {
    return [
      /(\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b)/g, // Credit card
      /("password"\s*:\s*)"[^"]*"/gi, // Password fields
      /("token"\s*:\s*)"[^"]*"/gi, // Token fields
      /("ssn"\s*:\s*)"[^"]*"/gi, // SSN
      /(\b\d{3}-\d{2}-\d{4}\b)/g, // SSN format
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // Email
      /(\+?\d{1,3}[-.\s]?)?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // Phone
    ];
  }

  private redact(message: string): string {
    let redacted = message;
    for (const pattern of this.redactionPatterns) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }
    return redacted;
  }

  private redactContext(context: LogContext): LogContext {
    const redacted: LogContext = {};
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        redacted[key] = this.redact(value);
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactContext(value as LogContext);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  log(level: LogLevel, message: string, context?: LogContext): void {
    const redactedMessage = this.redact(message);
    const redactedContext = context ? this.redactContext(context) : {};

    const logEntry = {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level,
      message: redactedMessage,
      ...redactedContext,
    };

    console[level === 'error' || level === 'warn' ? level : 'log'](logEntry);

    if (level === 'error') {
      Sentry.captureException(new Error(redactedMessage), { contexts: { custom: redactedContext } });
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }
}
