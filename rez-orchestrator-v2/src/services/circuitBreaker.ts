/**
 * Circuit Breaker for Orchestrator Expert Calls
 * Prevents cascading failures when calling expert agents
 *
 * Circuit States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests fail fast
 * - HALF_OPEN: Testing recovery, allows limited requests
 */

import { EventEmitter } from 'events';
import { appConfig } from '../config';
import { logger } from '../utils/logger';

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
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  averageResponseTimeMs: number;
  totalResponseTimeMs: number;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenMaxCalls?: number;
  name?: string;
}

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 3,
  resetTimeout: 30000,
  halfOpenMaxCalls: 1,
  name: 'default',
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

  // Performance tracking
  private totalRequests: number = 0;
  private totalResponseTimeMs: number = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    super();
    this.name = options.name || 'default';

    // Use provided options or fall back to config defaults
    this.failureThreshold = options.failureThreshold ??
      appConfig.agent.healthCheckIntervalMs === 30000 ? 3 : 3;
    this.resetTimeout = options.resetTimeout ?? 30000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls ?? 1;
  }

  /**
   * Check if the circuit allows requests
   */
  canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN: {
        const timeSinceStateChange = Date.now() - this.lastStateChange.getTime();
        if (timeSinceStateChange >= this.resetTimeout) {
          this.transitionTo(CircuitState.HALF_OPEN);
          return this.canExecute();
        }
        return false;
      }

      case CircuitState.HALF_OPEN:
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
  recordSuccess(responseTimeMs?: number): void {
    this.lastSuccess = new Date();
    this.successes++;
    this.totalRequests++;
    this.consecutiveFailures = 0;

    if (responseTimeMs !== undefined) {
      this.totalResponseTimeMs += responseTimeMs;
    }

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        // Successful test - transition back to closed
        this.transitionTo(CircuitState.CLOSED);
        this.resetCounters();
        logger.info('Circuit breaker recovered', {
          circuit: this.name,
          previousFailures: this.failures,
        });
        break;

      case CircuitState.CLOSED:
        // Decay failures slowly (half-life based decay)
        if (this.failures > 0) {
          this.failures = Math.max(0, this.failures - 0.5);
        }
        break;
    }

    this.emit('success', {
      circuit: this.name,
      state: this.state,
      totalSuccesses: this.successes,
    });
  }

  /**
   * Record a failed call
   */
  recordFailure(error?: string): void {
    this.lastFailure = new Date();
    this.failures++;
    this.totalRequests++;
    this.consecutiveFailures++;

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        // Failed during recovery test - go back to open
        this.transitionTo(CircuitState.OPEN);
        this.scheduleReset();
        logger.warn('Circuit breaker recovery failed', {
          circuit: this.name,
          error,
        });
        break;

      case CircuitState.CLOSED:
        if (this.consecutiveFailures >= this.failureThreshold) {
          this.transitionTo(CircuitState.OPEN);
          this.scheduleReset();
          logger.error('Circuit breaker opened', {
            circuit: this.name,
            consecutiveFailures: this.consecutiveFailures,
            threshold: this.failureThreshold,
            lastError: error,
          });
          this.emit('circuit_opened', {
            circuit: this.name,
            consecutiveFailures: this.consecutiveFailures,
            threshold: this.failureThreshold,
            lastError: error,
          });
        }
        break;
    }

    this.emit('failure', {
      circuit: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      error,
    });
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    const averageResponseTimeMs = this.totalRequests > 0
      ? this.totalResponseTimeMs / this.totalRequests
      : 0;

    return {
      name: this.name,
      state: this.state,
      failures: Math.floor(this.failures),
      successes: this.successes,
      lastFailure: this.lastFailure?.toISOString() || null,
      lastSuccess: this.lastSuccess?.toISOString() || null,
      lastStateChange: this.lastStateChange.toISOString(),
      consecutiveFailures: this.consecutiveFailures,
      totalRequests: this.totalRequests,
      totalFailures: Math.floor(this.failures),
      totalSuccesses: this.successes,
      averageResponseTimeMs: Math.round(averageResponseTimeMs),
      totalResponseTimeMs: this.totalResponseTimeMs,
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
    logger.info('Circuit breaker state forced', {
      circuit: this.name,
      forcedState: state,
    });
  }

  /**
   * Reset all counters and close the circuit
   */
  reset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.transitionTo(CircuitState.CLOSED);
    this.resetCounters();
    this.totalRequests = 0;
    this.totalResponseTimeMs = 0;
    logger.info('Circuit breaker reset', { circuit: this.name });
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();

    if (oldState !== newState) {
      this.emit('state_change', {
        circuit: this.name,
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
      this.emit('half_open', {
        circuit: this.name,
        scheduledReset: true,
      });
      logger.info('Circuit breaker scheduled half-open', {
        circuit: this.name,
        resetTimeout: this.resetTimeout,
      });
    }, this.resetTimeout);
  }
}

/**
 * Circuit Breaker Registry
 * Manages circuit breakers for multiple expert agents
 */
export class CircuitBreakerRegistry {
  private circuits: Map<string, CircuitBreaker> = new Map();
  private globalStats: {
    totalCircuitsOpened: number;
    totalRecoveries: number;
    lastReset: Date;
  } = {
    totalCircuitsOpened: 0,
    totalRecoveries: 0,
    lastReset: new Date(),
  };

  /**
   * Get or create a circuit breaker for an agent
   */
  getCircuit(agentId: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let circuit = this.circuits.get(agentId);

    if (!circuit) {
      circuit = new CircuitBreaker({
        ...options,
        name: agentId,
      });

      circuit.on('circuit_opened', () => {
        this.globalStats.totalCircuitsOpened++;
        logger.error('Expert circuit opened', { agentId });
      });

      circuit.on('half_open', () => {
        this.globalStats.totalRecoveries++;
        logger.info('Expert circuit half-open', { agentId });
      });

      this.circuits.set(agentId, circuit);
    }

    return circuit;
  }

  /**
   * Get all circuit breaker statistics
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
   * Check if an agent is available (circuit not open)
   */
  isAvailable(agentId: string): boolean {
    const circuit = this.circuits.get(agentId);
    if (!circuit) return true; // Unknown agents are assumed available
    return circuit.getState() !== CircuitState.OPEN;
  }

  /**
   * Get list of unavailable agents
   */
  getUnavailableAgents(): string[] {
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
    logger.info('All expert circuit breakers reset');
  }

  /**
   * Remove a circuit breaker
   */
  remove(agentId: string): boolean {
    return this.circuits.delete(agentId);
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
