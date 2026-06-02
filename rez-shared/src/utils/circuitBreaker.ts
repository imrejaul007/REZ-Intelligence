/**
 * Circuit Breaker Pattern Implementation
 *
 * Provides graceful degradation when external services are failing.
 * Prevents cascading failures across services.
 *
 * Usage:
 * ```typescript
 * const redisBreaker = new CircuitBreaker(async () => {
 *   return await redis.get(key);
 * }, { timeout: 3000, threshold: 50 });
 *
 * const result = await redisBreaker.call()
 *   .catch(() => fallbackValue);
 * ```
 */

import { createServiceLogger } from '../config/logger';

const logger = createServiceLogger('circuit-breaker');

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Service failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerOptions {
  timeout?: number; // Timeout in ms (default: 3000)
  errorThresholdPercentage?: number; // Open after X% failures (default: 50)
  resetTimeout?: number; // Try recovery after X ms (default: 30000)
  name?: string; // For logging
  onOpen?: () => void; // Callback when circuit opens
  onHalfOpen?: () => void; // Callback when trying recovery
  onClose?: () => void; // Callback when circuit closes
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private requestCount = 0;
  private lastFailureTime?: number;
  private nextAttemptTime?: number;

  private readonly timeout: number;
  private readonly errorThresholdPercentage: number;
  private readonly resetTimeout: number;
  private readonly name: string;
  private readonly onOpen?: () => void;
  private readonly onHalfOpen?: () => void;
  private readonly onClose?: () => void;

  constructor(
    private fn: () => Promise<any>,
    options: CircuitBreakerOptions = {}
  ) {
    this.timeout = options.timeout || 3000;
    this.errorThresholdPercentage = options.errorThresholdPercentage || 50;
    this.resetTimeout = options.resetTimeout || 30000;
    this.name = options.name || 'CircuitBreaker';
    this.onOpen = options.onOpen;
    this.onHalfOpen = options.onHalfOpen;
    this.onClose = options.onClose;
  }

  /**
   * Call the protected function
   */
  async call(): Promise<any> {
    this.requestCount++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      // Check if it's time to attempt recovery
      if (Date.now() >= (this.nextAttemptTime || 0)) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        throw new Error(`[${this.name}] Circuit breaker is OPEN. Service unavailable.`);
      }
    }

    try {
      // Use Promise.race with proper timeout cleanup
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const result = await Promise.race([
        this.fn().finally(() => {
          if (timeoutId) clearTimeout(timeoutId);
        }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error(`[${this.name}] Request timeout after ${this.timeout}ms`)),
            this.timeout
          );
        }),
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record successful call
   */
  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;

    // If in HALF_OPEN state, transition back to CLOSED
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.CLOSED);
    }
  }

  /**
   * Record failed call
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Calculate failure percentage
    if (this.requestCount > 0) {
      const failurePercentage = (this.failureCount / this.requestCount) * 100;

      if (failurePercentage >= this.errorThresholdPercentage) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) {
      return;
    }

    const oldState = this.state;
    this.state = newState;

    logger.warn(`[${this.name}] Circuit breaker: ${oldState} → ${newState}`);

    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      this.onOpen?.();
    } else if (newState === CircuitState.HALF_OPEN) {
      this.onHalfOpen?.();
    } else if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      this.requestCount = 0;
      this.onClose?.();
    }
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`[${this.name}] Request timeout after ${this.timeout}ms`));
      }, this.timeout);
    });
  }

  /**
   * Get circuit status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      failurePercentage: this.requestCount > 0 ? (this.failureCount / this.requestCount) * 100 : 0,
    };
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    logger.warn(`[${this.name}] Circuit breaker reset`);
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }
}

/**
 * Circuit breaker for Redis operations
 */
export function createRedisCircuitBreaker(fn: () => Promise<any>, name = 'Redis'): CircuitBreaker {
  return new CircuitBreaker(fn, {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    name,
  });
}

/**
 * Circuit breaker for HTTP calls
 */
export function createHttpCircuitBreaker(fn: () => Promise<any>, name = 'HTTP'): CircuitBreaker {
  return new CircuitBreaker(fn, {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 60000,
    name,
  });
}

/**
 * Circuit breaker for database operations
 */
export function createDatabaseCircuitBreaker(fn: () => Promise<any>, name = 'Database'): CircuitBreaker {
  return new CircuitBreaker(fn, {
    timeout: 10000,
    errorThresholdPercentage: 25, // Lower threshold for DB - more critical
    resetTimeout: 60000,
    name,
  });
}

/**
 * Batch circuit breaker status report
 */
export function getCircuitBreakerStatus(breakers: Map<string, CircuitBreaker>) {
  const report: any[] = [];

  for (const [name, breaker] of breakers) {
    report.push({
      ...breaker.getStatus(),
    });
  }

  return report;
}
