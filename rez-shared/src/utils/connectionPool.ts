import axios, { AxiosInstance } from 'axios';

interface PoolConfig {
  maxSockets: number;
  maxFreeSockets: number;
  timeout: number;
  idleTimeout: number;
}

const DEFAULT_CONFIG: PoolConfig = {
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000,
  idleTimeout: 30000,
};

export class ConnectionPool {
  private pools: Map<string, AxiosInstance> = new Map();

  getClient(name: string, baseURL: string, config?: Partial<PoolConfig>): AxiosInstance {
    if (this.pools.has(name)) {
      return this.pools.get(name)!;
    }

    const client = axios.create({
      baseURL,
      timeout: config?.timeout ?? DEFAULT_CONFIG.timeout,
      httpAgent: {
        maxSockets: config?.maxSockets ?? DEFAULT_CONFIG.maxSockets,
        maxFreeSockets: config?.maxFreeSockets ?? DEFAULT_CONFIG.maxFreeSockets,
        idleTimeout: config?.idleTimeout ?? DEFAULT_CONFIG.idleTimeout,
      },
      httpsAgent: {
        maxSockets: config?.maxSockets ?? DEFAULT_CONFIG.maxSockets,
        maxFreeSockets: config?.maxFreeSockets ?? DEFAULT_CONFIG.maxFreeSockets,
        idleTimeout: config?.idleTimeout ?? DEFAULT_CONFIG.idleTimeout,
      },
    });

    // Add interceptors
    client.interceptors.request.use((config) => {
      // Add auth headers
      return config;
    });

    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Retry on network errors
        if (!error.response) {
          const retries = error.config?.__retryCount || 0;
          if (retries < 3) {
            error.config.__retryCount = retries + 1;
            return client.request(error.config);
          }
        }
        throw error;
      }
    );

    this.pools.set(name, client);
    return client;
  }

  getRazorpayClient(): AxiosInstance {
    return this.getClient('razorpay', 'https://api.razorpay.com/v1', {
      maxSockets: 50,
      timeout: 30000,
    });
  }

  getTwilioClient(): AxiosInstance {
    return this.getClient('twilio', 'https://api.twilio.com/2010-04-01', {
      maxSockets: 20,
      timeout: 10000,
    });
  }

  getFCMClient(): AxiosInstance {
    return this.getClient('fcm', 'https://fcm.googleapis.com/fcm', {
      maxSockets: 30,
      timeout: 10000,
    });
  }
}

export const connectionPool = new ConnectionPool();
