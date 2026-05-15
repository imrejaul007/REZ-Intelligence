/**
 * HashiCorp Vault Client for REZ Services
 * Provides secure secret management with automatic token renewal and caching
 */

import vault from 'node-vault';
import { EventEmitter } from 'events';

// Types
export interface VaultConfig {
  endpoint: string;
  token?: string;
  roleId?: string;
  secretId?: string;
  namespace?: string;
  prefix?: string;
  defaultTtl?: number;
  maxTtl?: number;
}

export interface SecretOptions {
  mount?: string;
  version?: number;
  consistent?: boolean;
}

export interface HealthStatus {
  initialized: boolean;
  sealed: boolean;
  standby: boolean;
  version: string;
  clusterName: string;
}

export interface LeaseInfo {
  lease_id: string;
  duration: number;
  renewable: boolean;
  issued_at: string;
  expire_time: string;
}

interface CachedSecret {
  value: unknown;
  expiresAt: number;
}

// Default configuration
const DEFAULT_CONFIG: Partial<VaultConfig> = {
  prefix: 'secret',
  defaultTtl: 3600,
  maxTtl: 86400,
};

/**
 * VaultClient - HashiCorp Vault client with caching and auto-renewal
 */
export class VaultClient extends EventEmitter {
  private client: vault.client;
  private config: VaultConfig;
  private secretCache: Map<string, CachedSecret> = new Map();
  private tokenRenewalTimer?: NodeJS.Timeout;
  private isConnected: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: VaultConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize vault client
    const clientOptions: vault.VaultOptions = {
      endpoint: this.config.endpoint,
    };

    if (this.config.token) {
      clientOptions.token = this.config.token;
    }

    if (this.config.namespace) {
      clientOptions.namespace = this.config.namespace;
    }

    this.client = vault(clientOptions);
  }

  /**
   * Initialize the Vault client
   * Handles AppRole authentication if roleId and secretId are provided
   */
  async initialize(): Promise<void> {
    try {
      // If using AppRole, authenticate first
      if (this.config.roleId && this.config.secretId) {
        await this.authenticateWithAppRole();
      }

      // Verify connection
      const health = await this.healthCheck();
      if (!health.initialized) {
        throw new Error('Vault is not initialized');
      }
      if (health.sealed) {
        throw new Error('Vault is sealed');
      }

      this.isConnected = true;
      this.emit('connected', health);

      // Start health monitoring
      this.startHealthMonitoring();
    } catch (error) {
      this.isConnected = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Authenticate using AppRole method
   */
  async authenticateWithAppRole(): Promise<void> {
    const result = await this.client.approle({
      role_id: this.config.roleId!,
      secret_id: this.config.secretId!,
    });

    this.client = vault({
      endpoint: this.config.endpoint,
      token: result.auth.client_token,
      namespace: this.config.namespace,
    });

    // Set up token renewal
    this.scheduleTokenRenewal(result.auth.lease_duration);
  }

  /**
   * Read a secret from Vault
   */
  async read<T = unknown>(path: string, options: SecretOptions = {}): Promise<T> {
    const cacheKey = `${options.mount || this.config.prefix}/${path}`;
    const cached = this.getFromCache(cacheKey);

    if (cached !== null) {
      return cached as T;
    }

    const fullPath = `${options.mount || this.config.prefix}/${path}`;

    try {
      const result = await this.client.read(fullPath);

      if (!result.data) {
        throw new Error(`Secret not found at path: ${fullPath}`);
      }

      // Cache the secret
      this.setInCache(cacheKey, result.data);

      return result.data as T;
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new SecretNotFoundError(fullPath);
      }
      throw error;
    }
  }

  /**
   * Write a secret to Vault
   */
  async write(
    path: string,
    data: Record<string, unknown>,
    options: SecretOptions = {}
  ): Promise<LeaseInfo | void> {
    const fullPath = `${options.mount || this.config.prefix}/${path}`;

    try {
      const result = await this.client.write(fullPath, data);

      // Invalidate cache for this path
      this.invalidateCache(fullPath);

      if (result.lease_id) {
        return {
          lease_id: result.lease_id,
          duration: result.lease_duration,
          renewable: result.renewable,
          issued_at: result.issued_at,
          expire_time: result.expire_time,
        };
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Delete a secret from Vault
   */
  async delete(path: string, options: SecretOptions = {}): Promise<void> {
    const fullPath = `${options.mount || this.config.prefix}/${path}`;

    try {
      await this.client.delete(fullPath);

      // Invalidate cache
      this.invalidateCache(fullPath);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * List secrets at a path
   */
  async list(path: string, options: SecretOptions = {}): Promise<string[]> {
    const fullPath = `${options.mount || this.config.prefix}/${path}`;

    try {
      const result = await this.client.list(fullPath);
      return result.data?.keys || [];
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Read multiple secrets in parallel
   */
  async readMany<T = Record<string, unknown>>(
    paths: string[],
    options: SecretOptions = {}
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    await Promise.all(
      paths.map(async (path) => {
        try {
          const secret = await this.read<T>(path, options);
          results.set(path, secret);
        } catch (error) {
          if (!(error instanceof SecretNotFoundError)) {
            throw error;
          }
        }
      })
    );

    return results;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthStatus> {
    const result = await this.client.health();

    return {
      initialized: result.initialized ?? false,
      sealed: result.sealed ?? true,
      standby: result.standby ?? true,
      version: result.version ?? 'unknown',
      clusterName: result.cluster_name ?? 'unknown',
    };
  }

  /**
   * Check if client is connected
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Close the client and cleanup
   */
  async close(): Promise<void> {
    this.stopHealthMonitoring();
    this.stopTokenRenewal();
    this.clearCache();
    this.isConnected = false;
    this.emit('disconnected');
  }

  /**
   * Generate dynamic database credentials
   */
  async generateDatabaseCredentials(
    roleName: string,
    mountPoint: string = 'database'
  ): Promise<{
    username: string;
    password: string;
    lease_id: string;
    expire_time: string;
  }> {
    try {
      const result = await this.client.read(`${mountPoint}/creds/${roleName}`);

      return {
        username: result.data.username,
        password: result.data.password,
        lease_id: result.lease_id,
        expire_time: result.expire_time,
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Encrypt data using Vault transit secrets engine
   */
  async encrypt(
    plaintext: string,
    keyName: string,
    mountPoint: string = 'transit'
  ): Promise<string> {
    try {
      const result = await this.client.encrypt(
        `${mountPoint}/encrypt/${keyName}`,
        { plaintext: Buffer.from(plaintext).toString('base64') }
      );
      return result.data.ciphertext;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Decrypt data using Vault transit secrets engine
   */
  async decrypt(
    ciphertext: string,
    keyName: string,
    mountPoint: string = 'transit'
  ): Promise<string> {
    try {
      const result = await this.client.decrypt(
        `${mountPoint}/decrypt/${keyName}`,
        { ciphertext }
      );
      return Buffer.from(result.data.plaintext, 'base64').toString('utf-8');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Private methods

  private getFromCache(key: string): unknown | null {
    const cached = this.secretCache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    this.secretCache.delete(key);
    return null;
  }

  private setInCache(key: string, value: unknown): void {
    const ttl = this.config.defaultTtl! * 1000;
    this.secretCache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  private invalidateCache(path: string): void {
    // Remove exact match
    this.secretCache.delete(path);

    // Remove any cached secrets under this path
    for (const key of this.secretCache.keys()) {
      if (key.startsWith(path)) {
        this.secretCache.delete(key);
      }
    }
  }

  private clearCache(): void {
    this.secretCache.clear();
  }

  private scheduleTokenRenewal(leaseDuration: number): void {
    // Renew token at 70% of lease duration
    const renewalInterval = Math.floor(leaseDuration * 0.7) * 1000;

    this.tokenRenewalTimer = setInterval(async () => {
      try {
        await this.client.reauth();
        this.emit('token-renewed');
      } catch (error) {
        this.emit('error', error);
      }
    }, renewalInterval);
  }

  private stopTokenRenewal(): void {
    if (this.tokenRenewalTimer) {
      clearInterval(this.tokenRenewalTimer);
      this.tokenRenewalTimer = undefined;
    }
  }

  private startHealthMonitoring(): void {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.healthCheck();

        if (health.sealed && this.isConnected) {
          this.isConnected = false;
          this.emit('sealed', health);
        } else if (!health.sealed && !this.isConnected) {
          this.isConnected = true;
          this.emit('unsealed', health);
        }
      } catch (error) {
        if (this.isConnected) {
          this.isConnected = false;
          this.emit('disconnected', error);
        }
      }
    }, 30000);
  }

  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
}

/**
 * Custom error for secrets not found
 */
export class SecretNotFoundError extends Error {
  constructor(path: string) {
    super(`Secret not found: ${path}`);
    this.name = 'SecretNotFoundError';
  }
}

/**
 * Factory function to create a configured VaultClient
 */
export function createVaultClient(config: VaultConfig): VaultClient {
  return new VaultClient(config);
}

// Default singleton instance (lazy initialization)
let defaultClient: VaultClient | null = null;

export function getVaultClient(config?: VaultConfig): VaultClient {
  if (!config && !defaultClient) {
    throw new Error('Vault client not initialized. Provide config on first call.');
  }

  if (config && !defaultClient) {
    defaultClient = createVaultClient(config);
  }

  return defaultClient!;
}

// Types export for consumers
export type { VaultOptions } from 'node-vault';
