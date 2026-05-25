import logger from './utils/logger';

/**
 * Base service client with retry logic and error handling
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';

export interface ClientConfig {
  baseUrl: string;
  internalToken: string;
  serviceName: string;
  timeout?: number;
  maxRetries?: number;
}

export class ServiceClient {
  protected client: AxiosInstance;
  protected serviceName: string;

  constructor(config: ClientConfig) {
    this.serviceName = config.serviceName;

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': config.internalToken,
        'X-Service-Connector': 'orchestrator',
      },
    });

    // Configure retry logic
    axiosRetry(this.client, {
      retries: config.maxRetries || 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        // Retry on network errors and 5xx responses
        if (axiosRetry.isNetworkOrIdempotentRequestError(error)) {
          return true;
        }
        const status = error.response?.status;
        return status !== undefined && status >= 500;
      },
      onRetry: (retryCount, error) => {
        console.warn(
          `[${this.serviceName}] Retry ${retryCount} after error: ${error.message}`
        );
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`[${this.serviceName}] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error(`[${this.serviceName}] Request error:`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`[${this.serviceName}] Response ${response.status}`);
        return response;
      },
      (error: AxiosError) => {
        console.error(`[${this.serviceName}] Response error:`, {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  protected async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }

  protected handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data as Record<string, unknown> | undefined;

      if (status === 401) {
        throw new Error(`${this.serviceName}: Authentication failed - invalid internal token`);
      }
      if (status === 403) {
        throw new Error(`${this.serviceName}: Access forbidden - insufficient permissions`);
      }
      if (status === 404) {
        throw new Error(`${this.serviceName}: Resource not found`);
      }
      if (status === 429) {
        throw new Error(`${this.serviceName}: Rate limit exceeded`);
      }
      if (status && status >= 400 && status < 500) {
        const message = data?.message || axiosError.message;
        throw new Error(`${this.serviceName}: Client error (${status}) - ${message}`);
      }
      if (status && status >= 500) {
        throw new Error(`${this.serviceName}: Server error (${status}) - service unavailable`);
      }
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`${this.serviceName}: Unknown error occurred`);
  }

  protected async safeRequest<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      return await this.request<T>(config);
    } catch (error) {
      this.handleError(error);
    }
  }
}
