/**
 * Credit Client - Service-to-service client for REZ Wallet Credit Service
 *
 * Used by vertical services to check BNPL eligibility, create BNPL transactions,
 * and record repayments.
 */

export type CreditVertical = 'hotel' | 'restaurant' | 'fashion' | 'pharmacy' | 'retail' | 'd2c';

export interface BNPLApplyParams {
  userId: string;
  phone: string;
  merchantId: string;
  merchantName?: string;
  vertical: CreditVertical;
  amount: number;
}

export interface BNPLRepayParams {
  userId: string;
  transactionId: string;
  amount: number;
}

export interface BNPLEligibilityParams {
  userId: string;
  phone: string;
  amount: number;
}

export interface CreditSummaryParams {
  userId: string;
  phone: string;
}

export interface CreditClientConfig {
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
    if (parsed['credit-client']) return parsed['credit-client'];
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

export class CreditClient {
  private baseUrl: string;
  private internalToken: string;
  private serviceName: string;
  private timeout: number;

  constructor(config: CreditClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.REZ_WALLET_SERVICE_URL || 'http://localhost:4004';
    this.internalToken = config.internalToken || getInternalToken();
    this.serviceName = config.serviceName || 'credit-client';
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Check BNPL eligibility for a user
   */
  async checkEligibility(params: BNPLEligibilityParams): Promise<{
    eligible: boolean;
    reason?: string;
    approvedAmount?: number;
    interestRate?: number;
    dueDate?: Date;
  }> {
    const url = `${this.baseUrl}/internal/credit/check-eligibility`;
    const headers = authHeaders(this.internalToken, this.serviceName);

    const result = await fetchJson<{ success: boolean; data: any }>(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: params.userId,
          phone: params.phone,
          amount: params.amount,
        }),
      },
      this.timeout
    );

    return result.data;
  }

  /**
   * Create a BNPL transaction
   */
  async applyBNPL(params: BNPLApplyParams): Promise<{
    _id: string;
    userId: string;
    amount: number;
    totalDue: number;
    dueDate: Date;
    status: string;
  }> {
    const url = `${this.baseUrl}/internal/credit/apply`;
    const headers = authHeaders(this.internalToken, this.serviceName);

    const result = await fetchJson<{ success: boolean; data: any }>(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: params.userId,
          phone: params.phone,
          merchantId: params.merchantId,
          merchantName: params.merchantName || 'Unknown',
          vertical: params.vertical,
          amount: params.amount,
        }),
      },
      this.timeout
    );

    return result.data;
  }

  /**
   * Repay a BNPL transaction
   */
  async repayBNPL(params: BNPLRepayParams): Promise<{
    _id: string;
    status: string;
    totalDue: number;
  }> {
    const url = `${this.baseUrl}/internal/credit/repay`;
    const headers = authHeaders(this.internalToken, this.serviceName);

    const result = await fetchJson<{ success: boolean; data: any }>(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: params.userId,
          transactionId: params.transactionId,
          amount: params.amount,
        }),
      },
      this.timeout
    );

    return result.data;
  }

  /**
   * Get active BNPL transactions for a user
   */
  async getActiveBNPLs(userId: string): Promise<any[]> {
    const url = `${this.baseUrl}/internal/credit/bnpl/${encodeURIComponent(userId)}`;
    const headers = authHeaders(this.internalToken, this.serviceName);

    const result = await fetchJson<{ success: boolean; data: any[] }>(
      url,
      { method: 'GET', headers },
      this.timeout
    );

    return result.data;
  }

  /**
   * Get credit score summary for a user
   */
  async getCreditSummary(params: CreditSummaryParams): Promise<{
    compositeScore: number;
    riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
    creditLimit: number;
    creditUsed: number;
    creditAvailable: number;
    interestRate: number;
    activeBNPLCount: number;
    totalOutstanding: number;
  }> {
    const url = `${this.baseUrl}/internal/credit/summary`;
    const headers = authHeaders(this.internalToken, this.serviceName);

    const result = await fetchJson<{ success: boolean; data: any }>(
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

    return result.data;
  }
}

// Singleton instance for convenience
let _instance: CreditClient | null = null;

export function getCreditClient(): CreditClient {
  if (!_instance) {
    _instance = new CreditClient();
  }
  return _instance;
}
