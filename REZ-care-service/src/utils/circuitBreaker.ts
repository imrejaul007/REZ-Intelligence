/**
 * REZ Care - Circuit Breaker Utility
 *
 * Implements circuit breaker pattern for RABTUL service calls
 * Provides graceful degradation when external services fail
 */

import { logger } from './logger';

// ============================================
// TYPES
// ============================================

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',          // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerConfig {
  name: string;
  timeout: number;            // ms to wait for response
  errorThresholdPercentage: number; // % errors to trip circuit
  resetTimeout: number;       // ms to wait before trying again
  monitorInterval: number;    // ms between health checks
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  averageResponseTime: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  uptime: number; // percentage
}

const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  monitorInterval: 10000,
};

// ============================================
// CIRCUIT BREAKER CLASS
// ============================================

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalCalls = 0;
  private rejectedCalls = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private nextAttemptTime: number = 0;
  private responseTimes: number[] = [];

  private readonly config: CircuitBreakerConfig;
  private readonly serviceName: string;

  constructor(serviceName: string, config?: Partial<CircuitBreakerConfig>) {
    this.serviceName = serviceName;
    this.config = {
      name: serviceName,
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    this.totalCalls++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        this.rejectedCalls++;
        logger.warn(`[CircuitBreaker:${this.serviceName}] Circuit OPEN - rejecting request`);

        if (fallback) {
          return fallback();
        }

        throw new Error(`Circuit breaker open for ${this.serviceName}`);
      }

      // Try to close the circuit
      this.state = CircuitState.HALF_OPEN;
      logger.info(`[CircuitBreaker:${this.serviceName}] Circuit HALF_OPEN - testing`);
    }

    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout after ${this.config.timeout}ms`));
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
   * Handle successful call
   */
  private onSuccess(responseTime: number) {
    this.successCount++;
    this.lastSuccessTime = new Date();
    this.responseTimes.push(responseTime);

    // Keep only last 100 response times
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      logger.info(`[CircuitBreaker:${this.serviceName}] Circuit CLOSED - service recovered`);
    }
  }

  /**
   * Handle failed call
   */
  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = new Date();

    const errorRate = this.failureCount / (this.failureCount + this.successCount || 1);

    if (this.state === CircuitState.HALF_OPEN) {
      // Immediate open on failure in half-open
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.resetTimeout;
      logger.warn(`[CircuitBreaker:${this.serviceName}] Circuit OPENED - half-open test failed`);
    } else if (errorRate >= this.config.errorThresholdPercentage / 100) {
      // Trip the circuit
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.resetTimeout;
      logger.warn(`[CircuitBreaker:${this.serviceName}] Circuit OPENED - error threshold reached (${(errorRate * 100).toFixed(1)}%)`);
    }
  }

  /**
   * Get circuit breaker stats
   */
  getStats(): CircuitBreakerStats {
    const avgResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;

    const uptime = this.totalCalls > 0
      ? (this.successCount / this.totalCalls) * 100
      : 100;

    return {
      name: this.serviceName,
      state: this.state,
      totalCalls: this.totalCalls,
      successfulCalls: this.successCount,
      failedCalls: this.failureCount,
      rejectedCalls: this.rejectedCalls,
      averageResponseTime: avgResponseTime,
      lastFailure: this.lastFailureTime,
      lastSuccess: this.lastSuccessTime,
      uptime,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force circuit to specific state (for testing/admin)
   */
  forceState(state: CircuitState) {
    this.state = state;
    if (state === CircuitState.CLOSED) {
      this.failureCount = 0;
    }
    logger.info(`[CircuitBreaker:${this.serviceName}] Force state: ${state}`);
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = 0;
    this.responseTimes = [];
    logger.info(`[CircuitBreaker:${this.serviceName}] Reset`);
  }
}

// ============================================
// CIRCUIT BREAKER REGISTRY
// ============================================

class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create circuit breaker for a service
   */
  get(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(serviceName, config));
    }
    return this.breakers.get(serviceName)!;
  }

  /**
   * Get all stats
   */
  getAllStats(): CircuitBreakerStats[] {
    return Array.from(this.breakers.values()).map(b => b.getStats());
  }

  /**
   * Check if unknown circuit is open
   */
  hasOpenCircuits(): boolean {
    return Array.from(this.breakers.values()).some(b => b.getState() === CircuitState.OPEN);
  }

  /**
   * Reset all circuits
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Export singleton registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a circuit breaker for a service
 */
export function createCircuitBreaker(
  serviceName: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  return circuitBreakerRegistry.get(serviceName, config);
}

/**
 * Wrap a function with circuit breaker
 */
export function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  fallback?: () => T | Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  return circuitBreakerRegistry.get(serviceName, config).execute(fn, fallback);
}

/**
 * Create circuit breakers for common RABTUL services
 */
export function initializeRABTULCircuitBreakers() {
  // Auth Service
  circuitBreakerRegistry.get('rabtul-auth', {
    name: 'rabtul-auth',
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  });

  // Wallet Service
  circuitBreakerRegistry.get('rabtul-wallet', {
    name: 'rabtul-wallet',
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  });

  // Payment Service
  circuitBreakerRegistry.get('rabtul-payment', {
    name: 'rabtul-payment',
    timeout: 10000,
    errorThresholdPercentage: 30,
    resetTimeout: 60000,
  });

  // Notification Service
  circuitBreakerRegistry.get('rabtul-notifications', {
    name: 'rabtul-notifications',
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  });

  // Profile Service
  circuitBreakerRegistry.get('rabtul-profile', {
    name: 'rabtul-profile',
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  });

  logger.info('[CircuitBreaker] Initialized RABTUL service circuit breakers');
}

export default {
  CircuitBreaker,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
  createCircuitBreaker,
  withCircuitBreaker,
  initializeRABTULCircuitBreakers,
  CircuitState,
};
