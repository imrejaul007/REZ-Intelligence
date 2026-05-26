/**
 * REZ Care Service - Service Configuration
 *
 * Centralized configuration for all service endpoints.
 * Pulls from environment variables with fallbacks.
 */

export const SERVICE_ENDPOINTS = {
  // RABTUL Core Services (4000-4030)
  auth: {
    url: process.env.AUTH_SERVICE_URL || process.env.REZ_AUTH_SERVICE_URL || 'http://localhost:4002',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },
  payment: {
    url: process.env.PAYMENT_SERVICE_URL || process.env.REZ_PAYMENT_SERVICE_URL || 'http://localhost:4001',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },
  wallet: {
    url: process.env.WALLET_SERVICE_URL || process.env.REZ_WALLET_SERVICE_URL || 'http://localhost:4004',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },
  order: {
    url: process.env.ORDER_SERVICE_URL || process.env.REZ_ORDER_SERVICE_URL || 'http://localhost:4006',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },
  catalog: {
    url: process.env.CATALOG_SERVICE_URL || 'http://localhost:4007',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },
  booking: {
    url: process.env.BOOKING_SERVICE_URL || 'http://localhost:4020',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },
  notifications: {
    url: process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:4011',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },
  profile: {
    url: process.env.PROFILE_SERVICE_URL || 'http://localhost:4013',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },
  analytics: {
    url: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4016',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },
  gamification: {
    url: process.env.GAMIFICATION_SERVICE_URL || 'http://localhost:4041',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },

  // REZ Intelligence Services
  predictiveEngine: {
    url: process.env.PREDICTIVE_ENGINE_URL || 'https://REZ-predictive-engine.onrender.com',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },
  intentGraph: {
    url: process.env.INTENT_GRAPH_URL || 'https://rez-intent-graph.onrender.com',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },
  supportCopilot: {
    url: process.env.SUPPORT_COPILOT_URL || 'https://REZ-support-copilot.onrender.com',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },

  // Internal Services
  supportDashboard: {
    url: process.env.SUPPORT_DASHBOARD_URL || process.env.SUPPORT_SERVICE_URL || 'https://rez-support-dashboard.onrender.com',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },
  merchantService: {
    url: process.env.MERCHANT_SERVICE_URL || 'https://rez-merchant-service.onrender.com',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },
  qrService: {
    url: process.env.QR_SERVICE_URL || 'https://rez-qr-service.onrender.com',
    token: process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
  },

  // Monitoring
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },

  // Webhook URLs
  webhooks: {
    slack: process.env.SLACK_WEBHOOK_URL,
    teams: process.env.TEAMS_WEBHOOK_URL,
  },
} as const;

// Type for service names
export type ServiceName = keyof typeof SERVICE_ENDPOINTS;

// Helper to get service config
export function getServiceConfig(serviceName: ServiceName) {
  return SERVICE_ENDPOINTS[serviceName];
}

// Helper to make authenticated requests
interface ServiceEndpoint {
  url: string;
  token: string;
}

export async function serviceRequest<T>(
  serviceName: ServiceName,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const config = SERVICE_ENDPOINTS[serviceName] as ServiceEndpoint;

  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': config.token,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Service ${serviceName} failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
