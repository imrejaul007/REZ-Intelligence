/**
 * Base service client with retry logic and error handling
 */
import { AxiosInstance, AxiosRequestConfig } from 'axios';
export interface ClientConfig {
    baseUrl: string;
    internalToken: string;
    serviceName: string;
    timeout?: number;
    maxRetries?: number;
}
export declare class ServiceClient {
    protected client: AxiosInstance;
    protected serviceName: string;
    constructor(config: ClientConfig);
    protected request<T>(config: AxiosRequestConfig): Promise<T>;
    protected handleError(error: unknown): never;
    protected safeRequest<T>(config: AxiosRequestConfig): Promise<T>;
}
//# sourceMappingURL=client.d.ts.map