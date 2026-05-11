'use strict';

const logger = require('./logger');

const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.halfOpenRequests = options.halfOpenRequests || 1;

    this.state = STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = Date.now();
    this.halfOpenCount = 0;

    this.halfOpenCallbacks = [];
    this.failureCallbacks = [];
  }

  async execute(fn, fallback) {
    if (this.state === STATES.OPEN) {
      if (Date.now() >= this.nextAttempt) {
        this.state = STATES.HALF_OPEN;
        this.halfOpenCount = 0;
        logger.info(`Circuit ${this.name}: OPEN -> HALF_OPEN`);
        this.halfOpenCallbacks.forEach(cb => cb());
      } else {
        logger.debug(`Circuit ${this.name}: OPEN, blocking request`);
        if (fallback) return fallback(new Error('Circuit breaker open'));
        throw new Error(`Circuit breaker ${this.name} is open`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) return fallback(error);
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;

    if (this.state === STATES.HALF_OPEN) {
      this.successes++;
      this.halfOpenCount++;

      if (this.halfOpenCount >= this.halfOpenRequests) {
        this.state = STATES.CLOSED;
        this.successes = 0;
        logger.info(`Circuit ${this.name}: HALF_OPEN -> CLOSED`);
      }
    }
  }

  onFailure() {
    this.failures++;

    if (this.state === STATES.HALF_OPEN) {
      this.state = STATES.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      logger.warn(`Circuit ${this.name}: HALF_OPEN -> OPEN, retry at ${this.nextAttempt}`);
      return;
    }

    if (this.failures >= this.failureThreshold) {
      this.state = STATES.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      logger.error(`Circuit ${this.name}: CLOSED -> OPEN, threshold: ${this.failures}`);
      this.failureCallbacks.forEach(cb => cb());
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      nextAttempt: this.nextAttempt,
      resetTimeout: this.resetTimeout
    };
  }

  reset() {
    this.state = STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.halfOpenCount = 0;
    logger.info(`Circuit ${this.name}: reset to CLOSED`);
  }

  onHalfOpen(callback) {
    this.halfOpenCallbacks.push(callback);
    return this;
  }

  onFailure(callback) {
    this.failureCallbacks.push(callback);
    return this;
  }
}

const circuitBreakers = new Map();

function getCircuitBreaker(name, options) {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker({ name, ...options }));
  }
  return circuitBreakers.get(name);
}

module.exports = {
  CircuitBreaker,
  getCircuitBreaker,
  STATES
};
