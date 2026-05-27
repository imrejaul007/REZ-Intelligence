/**
 * AI Service Circuit Breaker
 *
 * Provides circuit breaker pattern for AI/LLM API calls.
 * Prevents cascading failures when external AI services are down.
 *
 * Usage:
 *   import { createAICircuitBreaker } from '@rez/ai-circuit-breaker';
 *
 *   const breaker = createAICircuitBreaker('openai', {
 *     timeout: 10000,
 *     errorThresholdPercentage: 50,
 *     resetTimeout: 30000,
 *   });
 *
 *   const response = await breaker.execute(() => openai.chat.completions.create(...));
 */

import EventEmitter from 'events';
import logger from '../utils/logger.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  name: string;
  timeout: number; // ms to wait before considering it a failure
  errorThresholdPercentage: number; // % of failures to open circuit
  resetTimeout: number; // ms before trying again
  volumeThreshold: number; // minimum requests before calculating percentage
  slidingWindowSize: number; // number of requests to consider in window
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  rejections: number;
  averageResponseTime: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
}

/**
 * Circuit breaker states
 */
const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
} as const;

/**
 * Default configuration for AI services
 */
export const DEFAULT_AI_CIRCUIT_BREAKER_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  timeout: 30000, // 30 seconds for AI APIs
  errorThresholdPercentage: 50, // 50% failures opens circuit
  resetTimeout: 60000, // 60 seconds before trying again
  volumeThreshold: 10, // Need at least 10 requests
  slidingWindowSize: 100, // Track last 100 requests
};

/**
 * Sliding window for tracking requests
 */
class SlidingWindow {
  private window: Array<{ success: boolean; duration: number; timestamp: number }> = [];
  private maxSize: number;

  constructor(size: number) {
    this.maxSize = size;
  }

  add(success: boolean, duration: number): void {
    this.window.push({
      success,
      duration,
      timestamp: Date.now(),
    });

    // Remove old entries outside window
    while (this.window.length > this.maxSize) {
      this.window.shift();
    }
  }

  getStats(): { failureRate: number; averageDuration: number; totalRequests: number } {
    if (this.window.length === 0) {
      return { failureRate: 0, averageDuration: 0, totalRequests: 0 };
    }

    const failures = this.window.filter(r => !r.success).length;
    const totalDuration = this.window.reduce((sum, r) => sum + r.duration, 0);

    return {
      failureRate: failures / this.window.length,
      averageDuration: totalDuration / this.window.length,
      totalRequests: this.window.length,
    };
  }

  reset(): void {
    this.window = [];
  }
}

/**
 * Circuit Breaker implementation
 */
export class AICircuitBreaker {
  private state: CircuitState = STATES.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private rejectionCount = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private halfOpenAttempts = 0;
  private slidingWindow: SlidingWindow;

  constructor(private config: CircuitBreakerConfig) {
    this.slidingWindow = new SlidingWindow(config.slidingWindowSize);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();

    // Check if circuit is open
    if (this.state === STATES.OPEN) {
      this.rejectionCount++;

      // Check if we should try half-open
      if (this.shouldTryHalfOpen()) {
        this.transitionToHalfOpen();
      } else {
        logger.warn(`Circuit breaker [${this.config.name}] OPEN - rejecting request`);

        if (fallback) {
          return fallback();
        }

        throw new CircuitBreakerOpenError(
          this.config.name,
          this.getTimeUntilRetry()
        );
      }
    }

    // Execute the function with timeout
    try {
      const result = await this.executeWithTimeout(fn);

      // Success
      this.recordSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      // Failure
      const duration = Date.now() - startTime;
      this.recordFailure(duration);

      logger.error(`Circuit breaker [${this.config.name}] failure`, {
        error,
        duration,
        state: this.state,
      });

      if (fallback) {
        logger.info(`Circuit breaker [${this.config.name}] using fallback`);
        return fallback();
      }

      throw error;
    }
  }

  /**
   * Execute with timeout protection
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Circuit breaker [${this.config.name}] timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Record a successful request
   */
  private recordSuccess(duration: number): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();
    this.slidingWindow.add(true, duration);

    if (this.state === STATES.HALF_OPEN) {
      this.halfOpenAttempts++;
      // After 3 successful requests in half-open, close the circuit
      if (this.halfOpenAttempts >= 3) {
        this.transitionToClosed();
      }
    }
  }

  /**
   * Record a failed request
   */
  private recordFailure(duration: number): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.slidingWindow.add(false, duration);

    if (this.state === STATES.HALF_OPEN) {
      // Any failure in half-open immediately opens the circuit
      this.transitionToOpen();
    } else if (this.state === STATES.CLOSED) {
      // Check if we should open the circuit
      const stats = this.slidingWindow.getStats();

      if (
        stats.totalRequests >= this.config.volumeThreshold &&
        stats.failureRate >= this.config.errorThresholdPercentage / 100
      ) {
        logger.warn(
          `Circuit breaker [${this.config.name}] threshold exceeded: ` +
          `${(stats.failureRate * 100).toFixed(1)}% failures (threshold: ${this.config.errorThresholdPercentage}%)`
        );
        this.transitionToOpen();
      }
    }
  }

  /**
   * Check if we should try half-open state
   */
  private shouldTryHalfOpen(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime >= this.config.resetTimeout;
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state = STATES.OPEN;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = Date.now();

    logger.warn(`Circuit breaker [${this.config.name}] transitioned to OPEN`);

    // Emit event for monitoring
    this.emit('open', { name: this.config.name, timestamp: Date.now() });
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = STATES.HALF_OPEN;
    this.halfOpenAttempts = 0;

    logger.info(`Circuit breaker [${this.config.name}] transitioned to HALF_OPEN`);

    this.emit('halfOpen', { name: this.config.name, timestamp: Date.now() });
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = STATES.CLOSED;
    this.halfOpenAttempts = 0;
    this.slidingWindow.reset();

    logger.info(`Circuit breaker [${this.config.name}] transitioned to CLOSED`);

    this.emit('closed', { name: this.config.name, timestamp: Date.now() });
  }

  /**
   * Get time until circuit can try again
   */
  private getTimeUntilRetry(): number {
    if (!this.lastFailureTime) return 0;
    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.config.resetTimeout - elapsed);
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      name: this.config.name,
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      rejections: this.rejectionCount,
      averageResponseTime: this.slidingWindow.getStats().averageDuration,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.rejectionCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.halfOpenAttempts = 0;
    this.slidingWindow.reset();

    logger.info(`Circuit breaker [${this.config.name}] manually reset`);

    this.emit('reset', { name: this.config.name, timestamp: Date.now() });
  }

  /**
   * Force the circuit breaker to open
   */
  forceOpen(): void {
    this.transitionToOpen();
    logger.warn(`Circuit breaker [${this.config.name}] forced OPEN`);
  }
}

// Extend EventEmitter
AICircuitBreaker.prototype.emit = function (event: string, data: object) {
  return (this as unknown).events?.[event]?.forEach(cb => cb(data)) || false;
};

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly retryAfterMs: number
  ) {
    super(
      `Circuit breaker '${circuitName}' is OPEN. ` +
      `Retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`
    );
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Create a circuit breaker for AI services
 */
export function createAICircuitBreaker(
  name: string,
  config?: Partial<Omit<CircuitBreakerConfig, 'name'>>
): AICircuitBreaker {
  return new AICircuitBreaker({
    name,
    ...DEFAULT_AI_CIRCUIT_BREAKER_CONFIG,
    ...config,
  });
}

/**
 * Circuit breaker registry for managing multiple breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, AICircuitBreaker>();

  /**
   * Get or create a circuit breaker
   */
  get(name: string, config?: Partial<Omit<CircuitBreakerConfig, 'name'>>): AICircuitBreaker {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      breaker = createAICircuitBreaker(name, config);
      this.breakers.set(name, breaker);
    }

    return breaker;
  }

  /**
   * Get all circuit breaker stats
   */
  getAllStats(): CircuitBreakerStats[] {
    return Array.from(this.breakers.values()).map(b => b.getStats());
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

// Global registry
export const globalCircuitBreakerRegistry = new CircuitBreakerRegistry();
