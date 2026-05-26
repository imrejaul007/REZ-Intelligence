/**
 * REZ Care - Retry Utility with Exponential Backoff
 *
 * Provides automatic retry with exponential backoff for failed operations
 * Supports dead letter queue for failed messages
 */

import { logger } from './logger';
import { generateDLQId } from './idGenerator';
import { randomInt } from 'crypto';

// ============================================
// TYPES
// ============================================

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;      // ms
  maxDelay: number;          // ms
  backoffMultiplier: number;
  retryableStatuses?: number[]; // HTTP status codes to retry
  retryableErrors?: string[];   // Error messages to retry
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

export interface DLQConfig {
  enabled: boolean;
  maxSize?: number;
  onStore?: (item: DLQItem) => void;
}

export interface DLQItem {
  id: string;
  fnName: string;
  args: unknown[];
  error: Error;
  attempts: number;
  lastAttempt: Date;
  addedAt: Date;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'],
};

// ============================================
// DEAD LETTER QUEUE
// ============================================

class DeadLetterQueue {
  private items: DLQItem[] = [];
  private readonly config: DLQConfig;

  constructor(config: DLQConfig = { enabled: true }) {
    this.config = config;
  }

  /**
   * Store failed item
   */
  store(item: DLQItem): void {
    if (!this.config.enabled) return;

    // Check size limit
    if (this.config.maxSize && this.items.length >= this.config.maxSize) {
      // Remove oldest item
      this.items.shift();
    }

    this.items.push(item);
    logger.info(`[DLQ] Stored failed item: ${item.fnName}`, {
      error: item.error.message,
      attempts: item.attempts,
    });

    // Call custom handler if provided
    this.config.onStore?.(item);
  }

  /**
   * Get all items
   */
  getAll(): DLQItem[] {
    return [...this.items];
  }

  /**
   * Get items by function name
   */
  getByFn(fnName: string): DLQItem[] {
    return this.items.filter(item => item.fnName === fnName);
  }

  /**
   * Remove item by ID
   */
  remove(id: string): boolean {
    const index = this.items.findIndex(item => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Get size
   */
  size(): number {
    return this.items.length;
  }
}

// Export singleton
export const deadLetterQueue = new DeadLetterQueue();

// ============================================
// RETRY HELPER
// ============================================

/**
 * Check if error is retryable
 */
function isRetryable(error, config: RetryConfig): boolean {
  // Check if error is a fetch response error
  if (error?.response?.status) {
    const status = error.response.status;
    if (config.retryableStatuses?.includes(status)) {
      return true;
    }
    return false;
  }

  // Check error code for network errors
  if (error?.code) {
    if (config.retryableErrors?.includes(error.code)) {
      return true;
    }
  }

  // Check error message
  if (error?.message) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('network')) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff
  let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);

  // Cap at max delay
  delay = Math.min(delay, config.maxDelay);

  // Add jitter (0-25% randomization)
  // Using crypto.randomInt for secure jitter generation
  const jitter = delay * 0.25 * (randomInt(0, 100) / 100);
  delay = delay + jitter;

  return Math.floor(delay);
}

// ============================================
// RETRY FUNCTIONS
// ============================================

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  fnName: string = 'anonymous',
  config: Partial<RetryConfig> = {},
  args: unknown[] = []
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts: attempt,
        totalTime: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error;
      logger.warn(`[Retry] ${fnName} attempt ${attempt}/${finalConfig.maxAttempts} failed`, {
        error: error.message,
        code: error.code,
        status: error?.response?.status,
      });

      // Check if we should retry
      if (attempt < finalConfig.maxAttempts && isRetryable(error, finalConfig)) {
        const delay = calculateDelay(attempt, finalConfig);
        logger.info(`[Retry] ${fnName} waiting ${delay}ms before retry`);
        await sleep(delay);
      } else {
        // No more retries or non-retryable error
        break;
      }
    }
  }

  // All attempts failed
  logger.error(`[Retry] ${fnName} failed after ${finalConfig.maxAttempts} attempts`, {
    error: lastError?.message,
  });

  // Store in dead letter queue
  deadLetterQueue.store({
    id: generateDLQId(),
    fnName,
    args,
    error: lastError!,
    attempts: finalConfig.maxAttempts,
    lastAttempt: new Date(),
    addedAt: new Date(),
  });

  return {
    success: false,
    error: lastError,
    attempts: finalConfig.maxAttempts,
    totalTime: Date.now() - startTime,
  };
}

/**
 * Retry with circuit breaker
 */
export async function withRetryAndCircuitBreaker<T>(
  fn: () => Promise<T>,
  fnName: string,
  circuitBreaker,
  config: Partial<RetryConfig> = {},
  args: unknown[] = []
): Promise<RetryResult<T>> {
  try {
    const result = await circuitBreaker.execute(
      () => withRetry(fn, fnName, config, args),
      () => ({
        success: false,
        error: new Error('Circuit breaker open'),
        attempts: 0,
        totalTime: 0,
      })
    );

    return result;
  } catch (error) {
    return {
      success: false,
      error: error as Error,
      attempts: 0,
      totalTime: 0,
    };
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a retry wrapper for a function
 */
export function retryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  fnName?: string,
  config?: Partial<RetryConfig>
): T {
  const name = fnName || fn.name;
  return ((...args: Parameters<T>) => {
    return withRetry(
      () => fn(...args),
      name,
      config,
      args
    ).then(result => {
      if (!result.success && result.error) {
        throw result.error;
      }
      return result.data;
    });
  }) as T;
}

// ============================================
// COMMON RETRY PATTERNS
// ============================================

/**
 * Retry a fetch call
 */
export async function retryFetch(
  url: string,
  options: RequestInit = {},
  config?: Partial<RetryConfig>
): Promise<Response> {
  const result = await withRetry(
    () => fetch(url, options),
    `fetch:${url}`,
    {
      ...config,
      retryableStatuses: config?.retryableStatuses || [408, 429, 500, 502, 503, 504],
      retryableErrors: config?.retryableErrors || ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'],
    }
  );

  if (!result.success) {
    throw result.error || new Error('Fetch failed after retries');
  }

  return result.data!;
}

/**
 * Retry an axios call
 */
export async function retryAxios<T>(
  axiosFn: () => Promise<T>,
  fnName: string = 'axios',
  config?: Partial<RetryConfig>
): Promise<T> {
  const result = await withRetry(
    axiosFn,
    fnName,
    {
      ...config,
      retryableStatuses: config?.retryableStatuses || [408, 429, 500, 502, 503, 504],
    }
  );

  if (!result.success) {
    throw result.error || new Error('Axios call failed after retries');
  }

  return result.data!;
}

export default {
  withRetry,
  withRetryAndCircuitBreaker,
  retryable,
  retryFetch,
  retryAxios,
  deadLetterQueue,
};
