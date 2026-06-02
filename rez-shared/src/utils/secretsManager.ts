/**
 * Secrets Manager
 *
 * Manages sensitive credentials and secrets.
 * Supports both environment variables and AWS Secrets Manager.
 *
 * Usage:
 * ```typescript
 * const secrets = new SecretsManager();
 * const apiKey = await secrets.get('razorpay-api-key');
 * secrets.validateRequired(['razorpay-api-key', 'razorpay-secret']);
 * ```
 */

import axios from 'axios';
import type Redis from 'ioredis';
import { createServiceLogger } from '../config/logger';

const logger = createServiceLogger('SecretsManager');

export type SecretSource = 'env' | 'aws' | 'vault';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Base secrets manager
 */
export class SecretsManager {
  private source: SecretSource;
  private redis?: Redis;
  private secretsCache = new Map<string, { value: string; expiresAt: number }>();

  private cacheKey(secretName: string): string {
    return `${this.source}:${secretName}`;
  }

  constructor(source: SecretSource = 'env', redis?: Redis) {
    this.source = source;
    this.redis = redis;
  }

  /**
   * Get a secret
   */
  async get(secretName: string): Promise<string | undefined> {
    // Check local cache first
    const cached = this.getFromCache(secretName);
    if (cached) return cached;

    // Fetch from appropriate source
    let value: string | undefined;

    switch (this.source) {
      case 'aws':
        value = await this.getFromAws(secretName);
        break;
      case 'vault':
        value = await this.getFromVault(secretName);
        break;
      case 'env':
      default:
        value = this.getFromEnv(secretName);
        break;
    }

    // Cache the result
    if (value) {
      this.setInCache(secretName, value);
    }

    return value;
  }

  /**
   * Get multiple secrets
   */
  async getMultiple(secretNames: string[]): Promise<Record<string, string | undefined>> {
    const secrets: Record<string, string | undefined> = {};

    for (const name of secretNames) {
      secrets[name] = await this.get(name);
    }

    return secrets;
  }

  /**
   * Validate that required secrets exist
   */
  async validateRequired(requiredSecrets: string[]): Promise<void> {
    const missing: string[] = [];

    for (const secret of requiredSecrets) {
      const value = await this.get(secret);
      if (!value) {
        missing.push(secret);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required secrets: ${missing.join(', ')}`);
    }
  }

  /**
   * Rotate a secret (store new value)
   */
  async rotate(secretName: string, newValue: string): Promise<void> {
    // Clear cache
    this.secretsCache.delete(this.cacheKey(secretName));

    switch (this.source) {
      case 'aws':
        // Note: AWS requires separate API call
        logger.warn(`[SecretsManager] AWS secret rotation requires AWS API call`);
        break;
      case 'vault':
        // Note: HashiCorp Vault requires separate API call
        logger.warn(`[SecretsManager] Vault secret rotation requires Vault API call`);
        break;
      case 'env':
      default:
        // Update environment variable
        process.env[this.formatEnvName(secretName)] = newValue;
        break;
    }
  }

  /**
   * Audit log: log secret access (for compliance)
   */
  async logAccess(secretName: string, userId?: string): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      secretName,
      userId: userId || 'system',
      source: this.source,
    };

    // Log to Redis for audit trail
    if (this.redis) {
      try {
        await this.redis.lpush(
          'audit:secrets',
          JSON.stringify(logEntry)
        );
      } catch (error) {
        logger.warn('[SecretsManager] Failed to log secret access:', error);
      }
    }

    // Also log to console/logger
    logger.debug('[SecretsManager] Secret accessed:', logEntry);
  }

  // ===== Private Methods =====

  private getFromEnv(secretName: string): string | undefined {
    const envName = this.formatEnvName(secretName);
    return process.env[envName];
  }

  private async getFromAws(secretName: string): Promise<string | undefined> {
    // Requires AWS SDK v3
    try {
      const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');

      const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await client.send(command);

      return response.SecretString;
    } catch (error) {
      logger.error(`[SecretsManager] Failed to get AWS secret "${secretName}":`, error);
      return undefined;
    }
  }

  private async getFromVault(secretName: string): Promise<string | undefined> {
    // Requires HashiCorp Vault
    try {
      const vaultAddr = process.env.VAULT_ADDR || 'http://localhost:8200';
      const vaultToken = process.env.VAULT_TOKEN;

      const response = await axios.get(
        `${vaultAddr}/v1/secret/data/${secretName}`,
        {
          headers: { 'X-Vault-Token': vaultToken },
        }
      );

      return response.data.data.data.value;
    } catch (error) {
      logger.error(`[SecretsManager] Failed to get Vault secret "${secretName}":`, error);
      return undefined;
    }
  }

  private formatEnvName(secretName: string): string {
    // Convert kebab-case to UPPER_SNAKE_CASE
    return secretName.replace(/-/g, '_').toUpperCase();
  }

  private getFromCache(secretName: string): string | undefined {
    const cached = this.secretsCache.get(this.cacheKey(secretName));

    if (!cached) return undefined;
    if (cached.expiresAt < Date.now()) {
      this.secretsCache.delete(this.cacheKey(secretName));
      return undefined;
    }

    return cached.value;
  }

  private setInCache(secretName: string, value: string): void {
    this.secretsCache.set(this.cacheKey(secretName), {
      value,
      expiresAt: Date.now() + CACHE_TTL,
    });
  }
}

/**
 * Pre-configured secret keys
 */
export const SECRET_KEYS = {
  // Payment gateways
  RAZORPAY_KEY_ID: 'razorpay-key-id',
  RAZORPAY_KEY_SECRET: 'razorpay-key-secret',

  // Email service
  SENDGRID_API_KEY: 'sendgrid-api-key',
  SMTP_PASSWORD: 'smtp-password',

  // SMS service
  TWILIO_AUTH_TOKEN: 'twilio-auth-token',
  TWILIO_API_KEY: 'twilio-api-key',

  // Authentication
  JWT_SECRET: 'jwt-secret',
  OAUTH_CLIENT_SECRET: 'oauth-client-secret',

  // Database
  DATABASE_PASSWORD: 'database-password',
  REDIS_PASSWORD: 'redis-password',

  // AWS credentials
  AWS_ACCESS_KEY_ID: 'aws-access-key-id',
  AWS_SECRET_ACCESS_KEY: 'aws-secret-access-key',

  // Third-party integrations
  STRIPE_SECRET_KEY: 'stripe-secret-key',
  PAYPAL_CLIENT_SECRET: 'paypal-client-secret',
  GOOGLE_MAPS_API_KEY: 'google-maps-api-key',
} as const;

/**
 * Audit secrets on startup
 */
export async function auditSecrets(
  secretsManager: SecretsManager,
  requiredSecrets: string[]
): Promise<void> {
  logger.debug('[SecretsManager] Auditing required secrets...');

  const results: Record<string, boolean> = {};
  for (const secret of requiredSecrets) {
    const value = await secretsManager.get(secret);
    results[secret] = !!value;
  }

  const missing = Object.entries(results)
    .filter(([_, exists]) => !exists)
    .map(([name]) => name);

  if (missing.length > 0) {
    logger.error('[SecretsManager] Missing secrets', { missing });
    throw new Error(`Missing required secrets: ${missing.join(', ')}`);
  }

  const configured = Object.entries(results)
    .filter(([_, exists]) => exists)
    .map(([name]) => name);

  logger.debug(`[SecretsManager] ✅ All ${configured.length} required secrets configured`);
}

/**
 * Check for hardcoded secrets in environment (for debugging)
 */
export function scanForHardcodedSecrets(): void {
  const suspiciousPatterns = {
    'razorpay-key': /rp_(live|test)_[a-zA-Z0-9]{14}/,
    'stripe-key': /(sk|pk)_(live|test)_[a-zA-Z0-9]{24,}/,
    'jwt-secret': /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*/,
    'api-key': /(api[-_]?key|apikey)\s*[:=]\s*["']([a-zA-Z0-9_-]{20,})["']/i,
  };

  const found: Record<string, string[]> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;

    for (const [pattern, regex] of Object.entries(suspiciousPatterns)) {
      if (regex.test(value)) {
        if (!found[pattern]) found[pattern] = [];
        found[pattern].push(key);
      }
    }
  }

  if (Object.keys(found).length > 0) {
    logger.warn('[SecretsManager] Potential hardcoded secrets detected', { found });
    logger.warn('[SecretsManager] Move these to a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)');
  }
}
