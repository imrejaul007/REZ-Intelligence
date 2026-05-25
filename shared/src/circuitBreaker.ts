/**
 * REZ Circuit Breaker Implementation
 * Production-ready circuit breaker pattern for external service calls
 */

import { EventEmitter } from 'events';
import { sleep } from './utils';

export interface CircuitBreakerOptions {
  timeout?: number; // ms to wait for operation
  errorThresholdPercentage?: number; // % of failures to trip circuit
  resetTimeout?: number; // ms before attempting to close circuit
  volumeThreshold?: number; // minimum calls before calculating %
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  averageResponseTime: number;
  state: CircuitState;
}

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 10
};

/**
 * Circuit breaker states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private totalCalls: number = 0;
  private successfulCalls: number = 0;
  private rejectedCalls: number = 0;
  private lastFailureTime: number = 0;
  private responseTimes: number[] = [];
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(private name: string, options: CircuitBreakerOptions = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.emit('half-open', { name: this.name });
      } else {
        this.rejectedCalls++;
        this.emit('rejected', { name: this.name });
        throw new CircuitBreakerOpenError(
          `Circuit breaker '${this.name}' is OPEN`
        );
      }
    }

    const startTime = Date.now();

    try {
      const result = await Promise.race([
        fn(),
        sleep(this.options.timeout).then(() => {
          throw new CircuitBreakerTimeoutError(
            `Circuit breaker '${this.name}' timeout after ${this.options.timeout}ms`
          );
        })
      ]);

      this.recordSuccess(Date.now() - startTime);
      return result as T;
    } catch (error) {
      this.recordFailure(Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Execute with fallback
   */
  async executeWithFallback<T>(
    fn: () => Promise<T>,
    fallback: T | (() => Promise<T>)
  ): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      this.emit('fallback', { name: this.name, error });

      if (typeof fallback === 'function') {
        return (fallback as () => Promise<T>)();
      }
      return fallback;
    }
  }

  /**
   * Record successful call
   */
  private recordSuccess(responseTime: number): void {
    this.totalCalls++;
    this.successfulCalls++;
    this.successes++;
    this.failures = 0;
    this.responseTimes.push(responseTime);

    // Keep only last 100 response times for averaging
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.emit('closed', { name: this.name });
    }

    this.emit('success', { name: this.name, responseTime });
  }

  /**
   * Record failed call
   */
  private recordFailure(responseTime: number): void {
    this.totalCalls++;
    this.failures++;
    this.lastFailureTime = Date.now();
    this.responseTimes.push(responseTime);

    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.emit('open', { name: this.name });
    } else if (this.state === 'CLOSED') {
      const failureRate = this.getFailureRate();

      if (
        this.totalCalls >= this.options.volumeThreshold &&
        failureRate >= this.options.errorThresholdPercentage
      ) {
        this.state = 'OPEN';
        this.emit('open', { name: this.name });
      }
    }

    this.emit('failure', { name: this.name, responseTime });
  }

  /**
   * Check if we should attempt to reset
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.options.resetTimeout;
  }

  /**
   * Calculate failure rate percentage
   */
  private getFailureRate(): number {
    if (this.totalCalls === 0) return 0;
    return (this.failures / this.totalCalls) * 100;
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    const avgResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;

    return {
      totalCalls: this.totalCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.totalCalls - this.successfulCalls,
      rejectedCalls: this.rejectedCalls,
      averageResponseTime: Math.round(avgResponseTime),
      state: this.state
    };
  }

  /**
   * Force circuit to specific state (for testing/admin)
   */
  forceState(state: CircuitState): void {
    this.state = state;
    this.emit('stateChange', { name: this.name, state });
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.totalCalls = 0;
    this.successfulCalls = 0;
    this.rejectedCalls = 0;
    this.responseTimes = [];
    this.emit('reset', { name: this.name });
  }
}

/**
 * Custom errors
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreakerTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerTimeoutError';
  }
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  get(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      breaker = new CircuitBreaker(name, options);
      this.breakers.set(name, breaker);
    }

    return breaker;
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }

    return stats;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Global registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

export default CircuitBreaker;
