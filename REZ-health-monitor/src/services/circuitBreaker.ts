/**
 * Circuit Breaker Implementation
 * Prevents cascading failures by tracking service health and implementing circuit breaker pattern
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail fast
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */

import { EventEmitter } from 'events';
import { getHealthMonitorConfig } from '../config/index.js';

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: string | null;
  lastSuccess: string | null;
  lastStateChange: string;
  consecutiveFailures: number;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenMaxCalls?: number;
}

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 3,
  resetTimeout: 30000,
  halfOpenMaxCalls: 1,
};

export class CircuitBreaker extends EventEmitter {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenMaxCalls: number;

  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private consecutiveFailures: number = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private lastStateChange: Date = new Date();
  private halfOpenCalls: number = 0;
  private resetTimer: NodeJS.Timeout | null = null;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    super();
    this.name = name;

    // Use provided options or load from config
    const config = getHealthMonitorConfig();
    this.failureThreshold = options.failureThreshold ?? config.circuitBreaker.failureThreshold;
    this.resetTimeout = options.resetTimeout ?? config.circuitBreaker.resetTimeoutMs;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls ?? config.circuitBreaker.halfOpenMaxCalls;
  }

  /**
   * Check if the circuit allows requests
   */
  canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if reset timeout has elapsed
        const timeSinceStateChange = Date.now() - this.lastStateChange.getTime();
        if (timeSinceStateChange >= this.resetTimeout) {
          this.transitionTo(CircuitState.HALF_OPEN);
          return this.canExecute();
        }
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited test calls
        if (this.halfOpenCalls < this.halfOpenMaxCalls) {
          this.halfOpenCalls++;
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Record a successful call
   */
  recordSuccess(): void {
    this.lastSuccess = new Date();
    this.successes++;
    this.consecutiveFailures = 0;

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        // Successful test call - transition back to closed
        this.transitionTo(CircuitState.CLOSED);
        this.resetCounters();
        break;

      case CircuitState.CLOSED:
        // Decay failures slowly (optional: implement sliding window)
        if (this.failures > 0) {
          this.failures = Math.max(0, this.failures - 1);
        }
        break;
    }

    this.emit('success', { name: this.name, state: this.state });
  }

  /**
   * Record a failed call
   */
  recordFailure(): void {
    this.lastFailure = new Date();
    this.failures++;
    this.consecutiveFailures++;

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        // Failed during recovery test - go back to open
        this.transitionTo(CircuitState.OPEN);
        this.scheduleReset();
        break;

      case CircuitState.CLOSED:
        // Check if we've hit the failure threshold
        if (this.consecutiveFailures >= this.failureThreshold) {
          this.transitionTo(CircuitState.OPEN);
          this.scheduleReset();
          this.emit('circuit_opened', {
            name: this.name,
            consecutiveFailures: this.consecutiveFailures,
            threshold: this.failureThreshold,
          });
        }
        break;
    }

    this.emit('failure', {
      name: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
    });
  }

  /**
   * Get current circuit breaker stats
   */
  getStats(): CircuitBreakerStats {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure?.toISOString() || null,
      lastSuccess: this.lastSuccess?.toISOString() || null,
      lastStateChange: this.lastStateChange.toISOString(),
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force a state transition (for testing or manual intervention)
   */
  forceState(state: CircuitState): void {
    this.transitionTo(state);
    this.resetCounters();
  }

  /**
   * Reset all counters
   */
  reset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.transitionTo(CircuitState.CLOSED);
    this.resetCounters();
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();

    if (oldState !== newState) {
      this.emit('state_change', {
        name: this.name,
        from: oldState,
        to: newState,
        timestamp: this.lastStateChange.toISOString(),
      });
    }
  }

  private resetCounters(): void {
    this.consecutiveFailures = 0;
    this.halfOpenCalls = 0;
  }

  private scheduleReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      this.transitionTo(CircuitState.HALF_OPEN);
      this.resetCounters();
      this.emit('half_open', { name: this.name });
    }, this.resetTimeout);
  }
}

/**
 * Circuit Breaker Registry
 * Manages circuit breakers for multiple services
 */
export class CircuitBreakerRegistry {
  private circuits: Map<string, CircuitBreaker> = new Map();
  private readonly globalStats: {
    totalCircuitsOpened: number;
    totalRecoveries: number;
    lastReset: Date;
  } = {
    totalCircuitsOpened: 0,
    totalRecoveries: 0,
    lastReset: new Date(),
  };

  /**
   * Get or create a circuit breaker for a service
   */
  getCircuit(serviceName: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let circuit = this.circuits.get(serviceName);

    if (!circuit) {
      circuit = new CircuitBreaker(serviceName, options);

      // Listen for circuit opened events
      circuit.on('circuit_opened', () => {
        this.globalStats.totalCircuitsOpened++;
      });

      // Listen for half-open (recovery) events
      circuit.on('half_open', () => {
        this.globalStats.totalRecoveries++;
      });

      this.circuits.set(serviceName, circuit);
    }

    return circuit;
  }

  /**
   * Get all circuit breaker stats
   */
  getAllStats(): {
    circuits: CircuitBreakerStats[];
    summary: {
      total: number;
      closed: number;
      open: number;
      halfOpen: number;
      totalCircuitsOpened: number;
      totalRecoveries: number;
      lastReset: string;
    };
  } {
    const circuits = Array.from(this.circuits.values()).map(cb => cb.getStats());

    return {
      circuits,
      summary: {
        total: circuits.length,
        closed: circuits.filter(c => c.state === CircuitState.CLOSED).length,
        open: circuits.filter(c => c.state === CircuitState.OPEN).length,
        halfOpen: circuits.filter(c => c.state === CircuitState.HALF_OPEN).length,
        totalCircuitsOpened: this.globalStats.totalCircuitsOpened,
        totalRecoveries: this.globalStats.totalRecoveries,
        lastReset: this.globalStats.lastReset.toISOString(),
      },
    };
  }

  /**
   * Check if unknown circuit is open for a service
   */
  isAvailable(serviceName: string): boolean {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) return true; // Unknown services are assumed available
    return circuit.getState() !== CircuitState.OPEN;
  }

  /**
   * Get services that are currently unavailable
   */
  getUnavailableServices(): string[] {
    return Array.from(this.circuits.entries())
      .filter(([_, circuit]) => circuit.getState() === CircuitState.OPEN)
      .map(([name]) => name);
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
    this.globalStats.lastReset = new Date();
  }

  /**
   * Remove a circuit breaker
   */
  remove(serviceName: string): boolean {
    return this.circuits.delete(serviceName);
  }
}

// Singleton instance
let registryInstance: CircuitBreakerRegistry | null = null;

export function getCircuitBreakerRegistry(): CircuitBreakerRegistry {
  if (!registryInstance) {
    registryInstance = new CircuitBreakerRegistry();
  }
  return registryInstance;
}

export function resetCircuitBreakerRegistry(): void {
  registryInstance = null;
}
