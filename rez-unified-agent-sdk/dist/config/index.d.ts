import type { Logger, RetryOptions, CircuitBreakerOptions, SDKConfig } from '../types';
export declare const DEFAULT_TIMEOUT = 30000;
export declare const DEFAULT_CIRCUIT_BREAKER: Required<CircuitBreakerOptions>;
export declare const DEFAULT_RETRY: Required<RetryOptions>;
export interface ServiceEndpoints {
    paymentService?: string;
    walletService?: string;
    orderService?: string;
    bookingService?: string;
    notificationService?: string;
    analyticsService?: string;
    catalogService?: string;
}
export declare const DEFAULT_SERVICE_ENDPOINTS: ServiceEndpoints;
export interface InternalTokenConfig {
    payment?: string;
    wallet?: string;
    order?: string;
    booking?: string;
    notification?: string;
    analytics?: string;
    catalog?: string;
}
export declare function loadInternalTokens(): InternalTokenConfig;
export declare function createDefaultLogger(label?: string): Logger;
export declare function validateConfig(config: unknown): SDKConfig;
export declare class ConfigBuilder {
    private config;
    withAgentId(agentId: string): this;
    withInternalTokens(tokens: InternalTokenConfig): this;
    withServices(endpoints: ServiceEndpoints): this;
    withTimeout(timeout: number): this;
    withCircuitBreaker(options: CircuitBreakerOptions): this;
    withRetry(options: RetryOptions): this;
    build(): SDKConfig;
}
export declare function createConfig(partial?: Partial<SDKConfig>): SDKConfig;
//# sourceMappingURL=index.d.ts.map