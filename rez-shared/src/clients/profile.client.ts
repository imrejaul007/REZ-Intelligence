/**
 * Profile Client - Service-to-service client for REZ Auth Profile Service
 *
 * Used by all vertical services to record user transactions and engagement
 * after successful order/payment completion.
 */

import crypto from 'crypto';

export type Vertical = 'hotel' | 'restaurant' | 'fashion' | 'pharmacy' | 'retail' | 'd2c';

export interface ProfileTransactionParams {
  userId: string;
  phone: string;
  vertical: Vertical;
  amount: number;
  merchantId: string;
  category?: string;
}

export interface ProfileEngagementParams {
  userId: string;
  phone: string;
}

export interface ProfileSummaryParams {
  userId: string;
  phone: string;
}

export interface ProfileClientConfig {
  baseUrl?: string;
  internalToken?: string;
  serviceName?: string;
  timeout?: number;
}

const DEFAULT_TIMEOUT = 5000;

function getInternalToken(): string {
  try {
    const raw = process.env.INTERNAL_SERVICE_TOKENS_JSON;
    const parsed = raw ? JSON.parse(raw) as Record<string, string> : {};
    if (parsed['profile-client']) return parsed['profile-client'];
  } catch { /* ignore */ }

  if (process.env.INTERNAL_SERVICE_TOKEN) {
    return process.env.INTERNAL_SERVICE_TOKEN;
  }

  return '';
}

function authHeaders(token: string, serviceName: string) {
  return {
    'Content-Type': 'application/json',
    'x-internal-service': serviceName,
    'x-internal-token': token,
  };
}

async function fetchJson<T>(url: string, options: RequestInit, timeout: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${error}`);
    }

    return await resp.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

export class ProfileClient {
  private baseUrl: string;
  private internalToken: string;
  private serviceName: string;
  private timeout: number;

  constructor(config: ProfileClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.REZ_AUTH_SERVICE_URL || 'http://localhost:4002';
    this.internalToken = config.internalToken || getInternalToken();
    this.serviceName = config.serviceName || 'profile-client';
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Record a transaction after successful order/payment completion
   */
  async recordTransaction(params: ProfileTransactionParams): Promise<void> {
    const url = `${this.baseUrl}/internal/profile/transaction`;
    const headers = authHeaders(this.internalToken, this.serviceName);

    await fetchJson<{ success: boolean; message?: string }>(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: params.userId,
          phone: params.phone,
          vertical: params.vertical,
          amount: params.amount,
          merchantId: params.merchantId,
          category: params.category || 'general',
        }),
      },
      this.timeout
    );
  }

  /**
   * Record user engagement (app open, etc.)
   */
  async recordEngagement(params: ProfileEngagementParams): Promise<void> {
    const url = `${this.baseUrl}/internal/profile/engagement`;
    const headers = authHeaders(this.internalToken, this.serviceName);

    await fetchJson<{ success: boolean; message?: string }>(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: params.userId,
          phone: params.phone,
        }),
      },
      this.timeout
    );
  }

  /**
   * Get user profile summary
   */
  async getProfileSummary(params: ProfileSummaryParams): Promise<{
    userId: string;
    phone: string;
    totalLifetimeSpend: number;
    totalTransactions: number;
    averageOrderValue: number;
    lifetimeValue: number;
    engagementScore: number;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  }> {
    const url = `${this.baseUrl}/internal/profile/${encodeURIComponent(params.userId)}?phone=${encodeURIComponent(params.phone)}`;
    const headers = authHeaders(this.internalToken, this.serviceName);

    const result = await fetchJson<{ success: boolean; data: any }>(
      url,
      { method: 'GET', headers },
      this.timeout
    );

    return result.data;
  }
}

// Singleton instance for convenience
let _instance: ProfileClient | null = null;

export function getProfileClient(): ProfileClient {
  if (!_instance) {
    _instance = new ProfileClient();
  }
  return _instance;
}
