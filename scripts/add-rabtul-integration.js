#!/usr/bin/env node
/**
 * Script to add RABTUL integration to all REZ-Intelligence services
 *
 * Usage: node scripts/add-rabtul-integration.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname + '/..';

// Services missing RABTUL integration
const MISSING_SERVICES = [
  'REZ-MIND-CLIENT',
  'REZ-ab-testing-service',
  'REZ-ab-testing',
  'REZ-action-engine',
  'REZ-ai-orchestrator',
  'REZ-ai-router',
  'REZ-analytics-orchestrator',
  'REZ-api-keys',
  'REZ-attribution-loyalty-bridge',
  'REZ-attribution-system',
  'REZ-audit-logging',
  'REZ-bootstrap-intelligence',
  'REZ-care-service',
  'REZ-cdp-service',
  'REZ-commerce-agents',
  'REZ-commerce-signal-connector',
  'REZ-consumer-graph',
  'REZ-consumer-loop',
  'REZ-corpperks-bridge',
  'REZ-creative-engine',
  'REZ-creator-network',
  'REZ-cross-company-loyalty',
  'REZ-cross-sell-engine',
  'REZ-customer-intelligence-hub',
  'REZ-data-governance',
  'REZ-data-warehouse',
  'REZ-delivery-intelligence',
  'REZ-delivery-tracking-service',
  'REZ-demand-forecast',
  'REZ-dooh-attribution',
  'REZ-dooh-intelligence',
  'REZ-ecosystem-hub',
  'REZ-enterprise-gateway',
  'REZ-error-intelligence',
  'REZ-event-bus',
  'REZ-event-connector',
  'REZ-event-platform',
  'REZ-experimentation-engine',
  'REZ-feature-flags',
  'REZ-feature-store',
  'REZ-feedback-collector',
  'REZ-flywheel-engine',
  'REZ-flywheel-mvp',
  'REZ-gift-card-service',
  'REZ-health-monitor',
  'REZ-hyperlocal-targeting',
  'REZ-identity-bridge',
  'REZ-identity-graph',
  'REZ-insights-service',
  'REZ-integration-sdk',
  'REZ-inventory-alerts-service',
  'REZ-inventory-intelligence',
  'REZ-inventory-sync',
  'REZ-karma-loyalty-bridge',
  'REZ-knowledge-graph',
  'REZ-ledger-service',
  'REZ-ltv-attribution',
  'REZ-memory-engine',
  'REZ-merchant-360',
  'REZ-merchant-brain',
  'REZ-merchant-intelligence',
  'REZ-merchant-os',
  'REZ-migration-scripts',
  'REZ-ml-observability',
  'REZ-ml-studio',
  'REZ-moment-ads',
  'REZ-multi-location-service',
  'REZ-notification-router',
  'REZ-observability-system',
  'REZ-observability',
  'REZ-offline-commerce-tracker',
  'REZ-payments-brain',
  'REZ-personalization-engine',
  'REZ-price-predictor',
  'REZ-qr-campaigns',
  'REZ-real-time-decision-engine',
  'REZ-realtime-gateway',
  'REZ-recommendation-engine',
  'REZ-reconciliation-service',
  'REZ-reorder-engine',
  'REZ-research-opportunity-agent',
  'REZ-reservation-service',
  'REZ-rfm-plus-service',
  'REZ-rfm-service',
  'REZ-staff-scheduling-service',
  'REZ-stream-processing',
  'REZ-supplier-marketplace',
  'REZ-support-copilot',
  'REZ-targeting-engine',
  'REZ-taste-profile',
  'REZ-ugc-engine',
  'REZ-unified-attribution',
  'REZ-unified-chat',
  'REZ-unified-commerce-graph',
  'REZ-unified-crm-hub',
  'REZ-unified-crm-ui',
  'REZ-unified-event-schema',
  'REZ-unified-identity',
  'REZ-unified-inventory',
  'REZ-unified-profile',
  'REZ-unified-recommendations',
  'REZ-universal-user-graph',
  'REZ-user-agents',
  'REZ-validation-dashboard',
  'REZ-visit-prediction',
  'REZ-waitlist-service',
];

// RABTUL Platform Integration Template
const RABTUL_PLATFORM_TEMPLATE = `/**
 * RABTUL Platform Integration
 * Connects service to RABTUL infrastructure
 */

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service-36vo.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'https://rez-analytics-service.onrender.com';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:4025';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Make authenticated internal API request
 */
async function internalRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(\`Platform API error: \${response.status}\`);
  }

  return response.json();
}

// ============================================
// AUTH OPERATIONS
// ============================================

export const authOperations = {
  async verify(token) {
    try {
      const res = await internalRequest(\`\${AUTH_URL}/api/auth/verify\`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      return res.success ? res.user : null;
    } catch {
      return null;
    }
  },

  async validateInternalToken() {
    try {
      const res = await internalRequest(\`\${AUTH_URL}/api/auth/internal/validate\`, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      return res.valid ?? false;
    } catch {
      return false;
    }
  },
};

// ============================================
// WALLET OPERATIONS
// ============================================

export const walletOperations = {
  async getBalance(userId) {
    try {
      const res = await internalRequest(\`\${WALLET_URL}/api/wallet/\${userId}/balance\`);
      return res.balance || 0;
    } catch {
      return 0;
    }
  },

  async addCoins(userId, amount, reason, metadata = {}) {
    try {
      await internalRequest(\`\${WALLET_URL}/api/wallet/add\`, {
        method: 'POST',
        body: JSON.stringify({ userId, amount, reason, metadata }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async deductCoins(userId, amount, reason, metadata = {}) {
    try {
      await internalRequest(\`\${WALLET_URL}/api/wallet/deduct\`, {
        method: 'POST',
        body: JSON.stringify({ userId, amount, reason, metadata }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async getTransactions(userId, limit = 20) {
    try {
      const res = await internalRequest(\`\${WALLET_URL}/api/wallet/\${userId}/transactions?limit=\${limit}\`);
      return res.transactions || [];
    } catch {
      return [];
    }
  },
};

// ============================================
// NOTIFICATION OPERATIONS
// ============================================

export const notificationOperations = {
  async send(params) {
    try {
      await internalRequest(\`\${NOTIFICATION_URL}/api/notifications/send\`, {
        method: 'POST',
        body: JSON.stringify({
          userId: params.userId,
          channel: params.channel || 'push',
          type: params.type || 'info',
          title: params.title,
          message: params.message,
          data: params.data,
        }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async sendBulk(notifications) {
    try {
      await internalRequest(\`\${NOTIFICATION_URL}/api/notifications/send/batch\`, {
        method: 'POST',
        body: JSON.stringify({ notifications }),
      });
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// ANALYTICS OPERATIONS
// ============================================

export const analyticsOperations = {
  async track(event, properties = {}) {
    try {
      await internalRequest(\`\${ANALYTICS_URL}/api/track\`, {
        method: 'POST',
        body: JSON.stringify({
          event,
          properties,
          timestamp: new Date().toISOString(),
        }),
      });
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// EVENT BUS OPERATIONS
// ============================================

export const eventBusOperations = {
  async publish(type, category, data, context = {}) {
    try {
      await internalRequest(\`\${EVENT_BUS_URL}/api/events\`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          category,
          version: '1.0.0',
          source: 'SERVICE_NAME',
          data,
          ...context,
          timestamp: new Date().toISOString(),
        }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async queryEvents(filters, limit = 100) {
    try {
      const res = await internalRequest(\`\${EVENT_BUS_URL}/api/events/query\`, {
        method: 'POST',
        body: JSON.stringify({ filters, limit }),
      });
      return res.events || [];
    } catch {
      return [];
    }
  },
};

// Default export
export default {
  auth: authOperations,
  wallet: walletOperations,
  notifications: notificationOperations,
  analytics: analyticsOperations,
  events: eventBusOperations,
};
`;

// REZ Intelligence Integration Template
const REZ_INTELLIGENCE_TEMPLATE = `/**
 * REZ Intelligence Integration
 * Connects to AI/ML services
 */

const INTENT_SERVICE_URL = process.env.INTENT_SERVICE_URL || 'https://rez-intent-predictor.onrender.com';
const PREDICTIVE_SERVICE_URL = process.env.PREDICTIVE_ENGINE_URL || 'https://REZ-predictive-engine.onrender.com';
const SIGNAL_SERVICE_URL = process.env.SIGNAL_AGGREGATOR_URL || 'https://REZ-signal-aggregator.onrender.com';
const RECOMMEND_SERVICE_URL = process.env.RECOMMENDATION_ENGINE_URL || 'https://REZ-recommendation-engine.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Make authenticated internal API request
 */
async function internalRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(\`Intelligence API error: \${response.status}\`);
  }

  return response.json();
}

// ============================================
// INTENT OPERATIONS
// ============================================

export const intentOperations = {
  async predict(userId, context = {}) {
    try {
      const res = await internalRequest(\`\${INTENT_SERVICE_URL}/api/intent/predict\`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, context }),
      });
      return res;
    } catch {
      return null;
    }
  },

  async captureSignal(signal) {
    try {
      await internalRequest(\`\${INTENT_SERVICE_URL}/api/intent/capture\`, {
        method: 'POST',
        body: JSON.stringify(signal),
      });
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// PREDICTIVE OPERATIONS
// ============================================

export const predictiveOperations = {
  async predictChurn(userId) {
    try {
      const res = await internalRequest(\`\${PREDICTIVE_SERVICE_URL}/predict/\${userId}/churn\`);
      return res;
    } catch {
      return null;
    }
  },

  async predictLTV(userId) {
    try {
      const res = await internalRequest(\`\${PREDICTIVE_SERVICE_URL}/predict/\${userId}/ltv\`);
      return res;
    } catch {
      return null;
    }
  },

  async predictRevisit(userId) {
    try {
      const res = await internalRequest(\`\${PREDICTIVE_SERVICE_URL}/predict/\${userId}/revisit\`);
      return res;
    } catch {
      return null;
    }
  },
};

// ============================================
// SIGNAL OPERATIONS
// ============================================

export const signalOperations = {
  async record(signal) {
    try {
      await internalRequest(\`\${SIGNAL_SERVICE_URL}/api/signals\`, {
        method: 'POST',
        body: JSON.stringify(signal),
      });
      return true;
    } catch {
      return false;
    }
  },

  async query(userId, filters = {}) {
    try {
      const res = await internalRequest(\`\${SIGNAL_SERVICE_URL}/api/signals/\${userId}\`, {
        method: 'GET',
        body: JSON.stringify(filters),
      });
      return res.signals || [];
    } catch {
      return [];
    }
  },
};

// ============================================
// RECOMMENDATION OPERATIONS
// ============================================

export const recommendationOperations = {
  async get(userId, slot = 'general') {
    try {
      const res = await internalRequest(\`\${RECOMMEND_SERVICE_URL}/api/recommendations/\${userId}\`, {
        method: 'GET',
        body: JSON.stringify({ slot }),
      });
      return res.recommendations || [];
    } catch {
      return [];
    }
  },
};

// Default export
export default {
  intent: intentOperations,
  predictive: predictiveOperations,
  signals: signalOperations,
  recommendations: recommendationOperations,
};
`;

// Integration index template
const INTEGRATION_INDEX_TEMPLATE = `/**
 * Integration Exports
 */

export * from './rabtulPlatform';
export { default as rabtulPlatform } from './rabtulPlatform';
export * from './rezIntelligence';
export { default as rezIntelligence } from './rezIntelligence';
`;

// Main function to add integrations
function addIntegration(serviceDir, serviceName) {
  const integrationsDir = path.join(serviceDir, 'src', 'integrations');

  // Create integrations directory if it doesn't exist
  if (!fs.existsSync(integrationsDir)) {
    fs.mkdirSync(integrationsDir, { recursive: true });
  }

  // Create RABTUL Platform integration
  const rabtulContent = RABTUL_PLATFORM_TEMPLATE.replace(/SERVICE_NAME/g, serviceName);
  const rabtulPath = path.join(integrationsDir, 'rabtulPlatform.ts');
  fs.writeFileSync(rabtulPath, rabtulContent);
  console.log('Created: ' + rabtulPath);

  // Create REZ Intelligence integration
  const intelligencePath = path.join(integrationsDir, 'rezIntelligence.ts');
  fs.writeFileSync(intelligencePath, REZ_INTELLIGENCE_TEMPLATE);
  console.log('Created: ' + intelligencePath);

  // Create index file
  const indexPath = path.join(integrationsDir, 'index.ts');
  fs.writeFileSync(indexPath, INTEGRATION_INDEX_TEMPLATE);
  console.log('Created: ' + indexPath);

  return true;
}

// Run for all missing services
console.log('Adding RABTUL integration to REZ-Intelligence services...\n');

let successCount = 0;
let failCount = 0;
let skipCount = 0;

for (const service of MISSING_SERVICES) {
  const serviceDir = path.join(ROOT_DIR, service);

  // Check if service directory exists
  if (!fs.existsSync(serviceDir)) {
    console.log('SKIP: ' + service + ' (directory not found)');
    skipCount++;
    continue;
  }

  // Check if src directory exists
  const srcDir = path.join(serviceDir, 'src');
  if (!fs.existsSync(srcDir)) {
    console.log('SKIP: ' + service + ' (no src directory)');
    skipCount++;
    continue;
  }

  try {
    addIntegration(serviceDir, service);
    successCount++;
  } catch (error) {
    console.log('ERROR: ' + service + ' - ' + error.message);
    failCount++;
  }
}

console.log('\n=== Summary ===');
console.log('Success: ' + successCount);
console.log('Skipped: ' + skipCount);
console.log('Failed: ' + failCount);
console.log('Total: ' + MISSING_SERVICES.length);
