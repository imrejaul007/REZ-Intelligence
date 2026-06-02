interface ErrorEvent {
  timestamp: Date;
  service: string;
  error: Error;
  context: Record<string, any>;
  userId?: string;
  requestId?: string;
}

class ErrorTracker {
  private errors: ErrorEvent[] = [];
  private maxErrors = 1000;

  track(error: Error, context: Record<string, any> = {}): void {
    const event: ErrorEvent = {
      timestamp: new Date(),
      service: process.env.SERVICE_NAME || 'unknown',
      error,
      context,
      requestId: context.requestId,
    };

    this.errors.push(event);

    // Keep only last N errors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log to console
    console.error('[ERROR TRACKER]', {
      service: event.service,
      message: error.message,
      stack: error.stack,
      context,
    });
  }

  getRecentErrors(count = 100): ErrorEvent[] {
    return this.errors.slice(-count);
  }

  getErrorsByType(type: string): ErrorEvent[] {
    return this.errors.filter(e => e.error.name === type);
  }

  getErrorRate(windowMs: number = 60000): number {
    const now = Date.now();
    const recent = this.errors.filter(e => now - e.timestamp.getTime() < windowMs);
    return recent.length / (windowMs / 1000); // errors per second
  }

  clear(): void {
    this.errors = [];
  }
}

export const errorTracker = new ErrorTracker();
