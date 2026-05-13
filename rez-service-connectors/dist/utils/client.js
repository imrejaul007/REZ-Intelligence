"use strict";
/**
 * Base service client with retry logic and error handling
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceClient = void 0;
const axios_1 = __importDefault(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
class ServiceClient {
    client;
    serviceName;
    constructor(config) {
        this.serviceName = config.serviceName;
        this.client = axios_1.default.create({
            baseURL: config.baseUrl,
            timeout: config.timeout || 30000,
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Token': config.internalToken,
                'X-Service-Connector': 'orchestrator',
            },
        });
        // Configure retry logic
        (0, axios_retry_1.default)(this.client, {
            retries: config.maxRetries || 3,
            retryDelay: axios_retry_1.default.exponentialDelay,
            retryCondition: (error) => {
                // Retry on network errors and 5xx responses
                if (axios_retry_1.default.isNetworkOrIdempotentRequestError(error)) {
                    return true;
                }
                const status = error.response?.status;
                return status !== undefined && status >= 500;
            },
            onRetry: (retryCount, error) => {
                console.warn(`[${this.serviceName}] Retry ${retryCount} after error: ${error.message}`);
            },
        });
        // Request interceptor for logging
        this.client.interceptors.request.use((config) => {
            console.debug(`[${this.serviceName}] ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        }, (error) => {
            console.error(`[${this.serviceName}] Request error:`, error);
            return Promise.reject(error);
        });
        // Response interceptor for logging
        this.client.interceptors.response.use((response) => {
            console.debug(`[${this.serviceName}] Response ${response.status}`);
            return response;
        }, (error) => {
            console.error(`[${this.serviceName}] Response error:`, {
                status: error.response?.status,
                message: error.message,
                url: error.config?.url,
            });
            return Promise.reject(error);
        });
    }
    async request(config) {
        const response = await this.client.request(config);
        return response.data;
    }
    handleError(error) {
        if (axios_1.default.isAxiosError(error)) {
            const axiosError = error;
            const status = axiosError.response?.status;
            const data = axiosError.response?.data;
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
    async safeRequest(config) {
        try {
            return await this.request(config);
        }
        catch (error) {
            this.handleError(error);
        }
    }
}
exports.ServiceClient = ServiceClient;
//# sourceMappingURL=client.js.map