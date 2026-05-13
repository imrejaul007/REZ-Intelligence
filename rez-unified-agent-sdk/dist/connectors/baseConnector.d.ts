import { AxiosInstance } from 'axios';
import CircuitBreaker from 'opossum';
import type { Logger, RetryOptions, CircuitBreakerOptions, HttpRequestConfig, HttpResponse } from '../types';
export declare abstract class BaseConnector {
    protected httpClient: AxiosInstance;
    protected logger: Logger;
    protected circuitBreaker: CircuitBreaker;
    protected retryOptions: Required<RetryOptions>;
    protected circuitBreakerOptions: Required<CircuitBreakerOptions>;
    protected serviceName: string;
    protected baseUrl: string;
    protected timeout: number;
    constructor(serviceName: string, baseUrl: string, authToken: string, options?: {
        logger?: Logger;
        timeout?: number;
        retry?: RetryOptions;
        circuitBreaker?: CircuitBreakerOptions;
    });
    /**
     * Execute HTTP request with retry logic
     */
    protected executeRequest<T>(config: HttpRequestConfig): Promise<HttpResponse<T>>;
    /**
     * Execute request through circuit breaker
     */
    protected executeWithCircuitBreaker<T>(config: HttpRequestConfig): Promise<HttpResponse<T>>;
    /**
     * Execute GET request
     */
    protected get<T>(path: string, params?: Record<string, string>): Promise<HttpResponse<T>>;
    /**
     * Execute POST request
     */
    protected post<T>(path: string, data?: unknown): Promise<HttpResponse<T>>;
    /**
     * Execute PUT request
     */
    protected put<T>(path: string, data?: unknown): Promise<HttpResponse<T>>;
    /**
     * Execute PATCH request
     */
    protected patch<T>(path: string, data?: unknown): Promise<HttpResponse<T>>;
    /**
     * Execute DELETE request
     */
    protected delete<T>(path: string): Promise<HttpResponse<T>>;
    /**
     * Retry logic with exponential backoff
     */
    private withRetry;
    /**
     * Check if error is non-retryable
     */
    private isNonRetryableError;
    /**
     * Calculate jitter delay
     */
    private calculateJitterDelay;
    /**
     * Sleep helper
     */
    private sleep;
    /**
     * Transform error to SDK error types
     */
    private transformError;
    /**
     * Get circuit breaker stats
     */
    getCircuitBreakerStats(): {
        enabled: boolean;
        opened: boolean;
        halfOpen: boolean;
        failures: number;
        successes: number;
        fallbacks: number;
        rejects: number;
    };
    /**
     * Check service health
     */
    checkHealth(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
        latency?: number;
        error?: string;
    }>;
    /**
     * Close connections and cleanup
     */
    close(): Promise<void>;
}
//# sourceMappingURL=baseConnector.d.ts.map