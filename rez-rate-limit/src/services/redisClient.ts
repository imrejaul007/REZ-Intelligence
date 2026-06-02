import Redis from 'ioredis';
import { config } from '../config';

class RedisClient {
  private static instance: RedisClient;
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private connectionPromise: Promise<Redis> | null = null;

  private constructor() {}

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<Redis> {
    if (this.client && this.isConnected) {
      return this.client;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.createConnection();
    return this.connectionPromise;
  }

  private async createConnection(): Promise<Redis> {
    return new Promise((resolve, reject) => {
      const redisConfig: any = {
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db,
        retryStrategy: (times: number) => {
          if (times > 10) {
            console.error('Redis connection failed after 10 retries');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      };

      if (config.redis.password) {
        redisConfig.password = config.redis.password;
      }

      this.client = new Redis(redisConfig);

      this.client.on('connect', () => {
        console.log('Redis client connecting...');
      });

      this.client.on('ready', () => {
        console.log('Redis client ready');
        this.isConnected = true;
        resolve(this.client!);
      });

      this.client.on('error', (err) => {
        console.error('Redis client error:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('Redis connection closed');
        this.isConnected = false;
      });

      // Timeout for initial connection
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Redis connection timeout'));
        }
      }, 10000);
    });
  }

  public getClient(): Redis | null {
    return this.client;
  }

  public isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      this.connectionPromise = null;
    }
  }
}

export const redisClient = RedisClient.getInstance();
