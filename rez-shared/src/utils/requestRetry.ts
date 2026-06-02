import { logger } from './logger'

interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryableStatuses?: number[]
  retryableErrors?: string[]
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'],
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (!isRetryable(error, opts)) {
        throw error
      }

      if (attempt === opts.maxRetries) break

      const delay = Math.min(
        opts.baseDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay,
      )

      logger.warn(`Retry ${attempt + 1}/${opts.maxRetries} after ${delay}ms`, {
        errorMessage: lastError.message,
      })
      await sleep(delay)
    }
  }

  throw lastError!
}

function isRetryable(error: unknown, opts: Required<RetryOptions>): boolean {
  const err = error as { code?: string; response?: { status?: number } } | null
  if (err?.code && opts.retryableErrors.includes(err.code)) return true
  if (err?.response?.status && opts.retryableStatuses.includes(err.response.status)) return true
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
