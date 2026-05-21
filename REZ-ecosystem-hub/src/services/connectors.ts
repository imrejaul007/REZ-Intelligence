/**
 * REZ Service Connectors
 * Connects all REZ services
 */

import axios from 'axios';

// Base URL configuration
const SERVICES = {
  // RABTUL Core
  auth: process.env.RABTUL_AUTH_URL || 'http://localhost:4002',
  payment: process.env.RABTUL_PAYMENT_URL || 'http://localhost:4001',
  wallet: process.env.RABTUL_WALLET_URL || 'http://localhost:4004',
  loyalty: process.env.LOYALTY_URL || 'http://localhost:4097',
  notifications: process.env.NOTIFICATIONS_URL || 'http://localhost:4011',
  profile: process.env.PROFILE_URL || 'http://localhost:4013',
  catalog: process.env.CATALOG_URL || 'http://localhost:4007',
  search: process.env.SEARCH_URL || 'http://localhost:4008',

  // REZ Intelligence
  identity: process.env.IDENTITY_URL || 'http://localhost:4050',
  signals: process.env.SIGNALS_URL || 'http://localhost:4121',
  predictive: process.env.PREDICTIVE_URL || 'http://localhost:4123',
  recommendation: process.env.RECOMMENDATION_URL || 'http://localhost:3001',
  personalization: process.env.PERSONALIZATION_URL || 'http://localhost:3002',

  // REZ Media
  karma: process.env.KARMA_URL || 'http://localhost:3009',
  ads: process.env.ADS_URL || 'http://localhost:4068',
  dooh: process.env.DOOH_URL || 'http://localhost:4018',

  // CorpPerks
  corpperks: process.env.CORPPERKS_URL || 'http://localhost:5000',

  // POS Integration
  pos: process.env.POS_URL || 'http://localhost:4095',
  merchant_dashboard: process.env.MERCHANT_URL || 'http://localhost:4090',
};

// ============================================
// HTTP Client
// ============================================

async function request<T = any>(
  service: keyof typeof SERVICES,
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: object;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const url = `${SERVICES[service]}${endpoint}`;
  const { method = 'GET', data, headers = {} } = options;

  try {
    const response = await axios({
      url,
      method,
      data,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    console.error(`Service ${service} failed:`, error);
    throw error;
  }
}

// ============================================
// AUTH CONNECTOR
// ============================================

export const auth = {
  async verify(token: string) {
    return request('auth', `/api/auth/verify`, {
      method: 'POST',
      data: { token },
    });
  },

  async getUser(token: string) {
    return request('auth', `/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

// ============================================
// WALLET CONNECTOR
// ============================================

export const wallet = {
  async getBalance(userId: string) {
    return request('wallet', `/api/v1/wallet/${userId}`);
  },

  async addCoins(userId: string, amount: number, reason: string) {
    return request('wallet', `/api/v1/wallet/${userId}/credit`, {
      method: 'POST',
      data: { amount, reason },
    });
  },

  async deductCoins(userId: string, amount: number, reason: string) {
    return request('wallet', `/api/v1/wallet/${userId}/debit`, {
      method: 'POST',
      data: { amount, reason },
    });
  },

  async transfer(fromId: string, toId: string, amount: number) {
    return request('wallet', `/api/v1/transfer`, {
      method: 'POST',
      data: { fromId, toId, amount },
    });
  },
};

// ============================================
// LOYALTY CONNECTOR
// ============================================

export const loyalty = {
  async getTier(userId: string) {
    return request('loyalty', `/api/tier/${userId}`);
  },

  async earn(userId: string, amount: number, source: string, description: string) {
    return request('loyalty', '/api/earn', {
      method: 'POST',
      data: { userId, amount, source, description },
    });
  },

  async redeem(userId: string, amount: number, rewardId: string) {
    return request('loyalty', '/api/redeem', {
      method: 'POST',
      data: { userId, amount, rewardId },
    });
  },

  async getBalance(userId: string) {
    return request('loyalty', `/api/balance/${userId}`);
  },

  async getTransactions(userId: string, limit = 10) {
    return request('loyalty', `/api/transactions/${userId}?limit=${limit}`);
  },
};

// ============================================
// PROFILE CONNECTOR
// ============================================

export const profile = {
  async get(userId: string) {
    return request('profile', `/api/profiles/${userId}`);
  },

  async update(userId: string, data: object) {
    return request('profile', `/api/profiles/${userId}`, {
      method: 'PUT',
      data,
    });
  },

  async search(query: string) {
    return request('profile', `/api/profiles/search?q=${encodeURIComponent(query)}`);
  },
};

// ============================================
// SIGNALS CONNECTOR
// ============================================

export const signals = {
  async track(event: {
    userId: string;
    action: string;
    source: string;
    data?: object;
    metadata?: object;
  }) {
    return request('signals', '/api/signals', {
      method: 'POST',
      data: event,
    });
  },

  async getUserSignals(userId: string, limit = 100) {
    return request('signals', `/api/users/${userId}/signals?limit=${limit}`);
  },

  async getAggregate(userId: string) {
    return request('signals', `/api/users/${userId}/aggregate`);
  },
};

// ============================================
// PREDICTIVE CONNECTOR
// ============================================

export const predictive = {
  async getChurnRisk(userId: string) {
    return request('predictive', `/api/churn/${userId}`);
  },

  async getLTV(userId: string) {
    return request('predictive', `/api/ltv/${userId}`);
  },

  async predict(userId: string) {
    return request('predictive', `/api/predict/${userId}`);
  },
};

// ============================================
// IDENTITY CONNECTOR
// ============================================

export const identity = {
  async resolve(identifiers: { email?: string; phone?: string; deviceId?: string }) {
    return request('identity', '/api/resolve', {
      method: 'POST',
      data: identifiers,
    });
  },

  async link(userId: string, identifiers: object) {
    return request('identity', `/api/users/${userId}/link`, {
      method: 'POST',
      data: identifiers,
    });
  },

  async getProfile(userId: string) {
    return request('identity', `/api/users/${userId}`);
  },
};

// ============================================
// KARMA CONNECTOR
// ============================================

export const karma = {
  async getScore(userId: string) {
    return request('karma', `/api/karma/user/${userId}`);
  },

  async earn(userId: string, action: string, points: number) {
    return request('karma', '/api/karma/earn', {
      method: 'POST',
      data: { userId, action, points },
    });
  },

  async verify(signal: { userId: string; type: string; data: object }) {
    return request('karma', '/api/karma/verify', {
      method: 'POST',
      data: signal,
    });
  },

  async getInitiatives() {
    return request('karma', '/api/initiatives');
  },

  async donate(userId: string, initiativeId: string, amount: number) {
    return request('karma', `/api/initiatives/${initiativeId}/donate`, {
      method: 'POST',
      data: { userId, amount },
    });
  },
};

// ============================================
// ADS CONNECTOR
// ============================================

export const ads = {
  async getTargetedAds(userId: string, context: object) {
    return request('ads', '/api/ads/targeted', {
      method: 'POST',
      data: { userId, context },
    });
  },

  async trackImpression(userId: string, adId: string) {
    return request('ads', '/api/ads/impression', {
      method: 'POST',
      data: { userId, adId },
    });
  },

  async trackClick(userId: string, adId: string) {
    return request('ads', '/api/ads/click', {
      method: 'POST',
      data: { userId, adId },
    });
  },

  async trackConversion(userId: string, adId: string, value: number) {
    return request('ads', '/api/ads/conversion', {
      method: 'POST',
      data: { userId, adId, value },
    });
  },
};

// ============================================
// DOOH CONNECTOR
// ============================================

export const dooh = {
  async registerScreen(screenId: string, location: object) {
    return request('dooh', '/api/screens', {
      method: 'POST',
      data: { screenId, ...location },
    });
  },

  async playContent(screenId: string, contentId: string) {
    return request('dooh', '/api/screens/${screenId}/play', {
      method: 'POST',
      data: { contentId },
    });
  },

  async getScreenAnalytics(screenId: string) {
    return request('dooh', `/api/screens/${screenId}/analytics`);
  },
};

// ============================================
// CORPPERKS CONNECTOR
// ============================================

export const corpperks = {
  async getEmployee(employeeId: string) {
    return request('corpperks', `/api/employees/${employeeId}`);
  },

  async syncAchievement(employeeId: string, achievement: object) {
    return request('corpperks', '/api/webhooks/employee-achievement', {
      method: 'POST',
      data: { employeeId, achievement },
    });
  },

  async syncMilestone(employeeId: string, milestone: object) {
    return request('corpperks', '/api/webhooks/employee-milestone', {
      method: 'POST',
      data: { employeeId, milestone },
    });
  },

  async getBenefits(employeeId: string) {
    return request('corpperks', `/api/employees/${employeeId}/benefits`);
  },
};

// ============================================
// POS CONNECTOR
// ============================================

export const pos = {
  async processSale(sale: {
    merchantId: string;
    userId?: string;
    orderId: string;
    amount: number;
    paymentMethod: string;
  }) {
    return request('pos', '/api/v1/pos/sale', {
      method: 'POST',
      data: sale,
    });
  },

  async scanQR(userId: string, merchantId: string, scanType: string) {
    return request('pos', '/api/v1/pos/scan', {
      method: 'POST',
      data: { userId, merchantId, scanType },
    });
  },

  async getMerchantDashboard(merchantId: string) {
    return request('merchant_dashboard', `/api/merchants/${merchantId}/dashboard`);
  },

  async getAtRiskCustomers(merchantId: string) {
    return request('merchant_dashboard', `/api/merchants/${merchantId}/at-risk`);
  },
};

// ============================================
// RECOMMENDATION CONNECTOR
// ============================================

export const recommendation = {
  async getProductRecommendations(userId: string, context: object = {}) {
    return request('recommendation', '/api/recommend/products', {
      method: 'POST',
      data: { userId, ...context },
    });
  },

  async trackRecommendation(userId: string, itemId: string, action: 'view' | 'click' | 'purchase') {
    return request('recommendation', '/api/recommend/track', {
      method: 'POST',
      data: { userId, itemId, action },
    });
  },

  async getContentRecommendations(userId: string) {
    return request('recommendation', '/api/recommend/content', {
      method: 'POST',
      data: { userId },
    });
  },

  async getPersonalizedFeed(userId: string) {
    return request('personalization', `/api/feed/${userId}`);
  },
};

// ============================================
// NOTIFICATIONS CONNECTOR
// ============================================

export const notifications = {
  async send(userId: string, notification: {
    type: 'push' | 'sms' | 'email' | 'whatsapp';
    title: string;
    body: string;
    data?: object;
  }) {
    return request('notifications', '/api/send', {
      method: 'POST',
      data: { userId, ...notification },
    });
  },

  async sendBulk(userIds: string[], notification: object) {
    return request('notifications', '/api/send-bulk', {
      method: 'POST',
      data: { userIds, ...notification },
    });
  },
};

// ============================================
// HEALTH CHECK
// ============================================

export async function healthCheck(service: keyof typeof SERVICES): Promise<boolean> {
  try {
    const response = await request(service, '/health');
    return response.status === 'healthy';
  } catch {
    return false;
  }
}

export async function getAllServicesHealth(): Promise<Record<string, boolean>> {
  const services = Object.keys(SERVICES) as (keyof typeof SERVICES)[];
  const results = await Promise.all(
    services.map(async (s) => [s, await healthCheck(s)])
  );
  return Object.fromEntries(results);
}

// ============================================
// EXPORTS
// ============================================

export const connectors = {
  auth,
  wallet,
  loyalty,
  profile,
  signals,
  predictive,
  identity,
  karma,
  ads,
  dooh,
  corpperks,
  pos,
  recommendation,
  notifications,
  health: {
    check: healthCheck,
    getAll: getAllServicesHealth,
  },
};

export default connectors;
