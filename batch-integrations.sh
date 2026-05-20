#!/bin/bash
# Batch create integration files for REZ-Intelligence services
# Run from REZ-Intelligence directory

set -e

# Template for rabtulPlatform.ts
create_rabtul_platform() {
  local service_name=$1
  cat > "$2/src/integrations/rabtulPlatform.ts" << 'TEMPLATE'
/**
 * RABTUL Platform Integration
 * Service: SERVICE_NAME
 */

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4002';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:4004';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4011';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4016';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:4025';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

async function request(url: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Auth Operations
export const auth = {
  verify: async (token: string) => request(`${AUTH_URL}/api/auth/verify`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  }),
};

// Wallet Operations
export const wallet = {
  addCoins: async (userId: string, amount: number, reason: string, metadata?: Record<string, any>) =>
    request(`${WALLET_URL}/api/wallet/add`, {
      method: 'POST',
      body: JSON.stringify({ userId, amount, reason, metadata }),
    }),
  deductCoins: async (userId: string, amount: number, reason: string) =>
    request(`${WALLET_URL}/api/wallet/deduct`, {
      method: 'POST',
      body: JSON.stringify({ userId, amount, reason }),
    }),
  getBalance: async (userId: string) => request(`${WALLET_URL}/api/wallet/balance/${userId}`),
};

// Notification Operations
export const notifications = {
  send: async (params: { userId: string; title: string; message: string; type?: string; data?: any }) =>
    request(`${NOTIFICATION_URL}/api/notifications/send`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  sendBulk: async (notifications: any[]) =>
    request(`${NOTIFICATION_URL}/api/notifications/send/batch`, {
      method: 'POST',
      body: JSON.stringify({ notifications }),
    }),
};

// Analytics Operations
export const analytics = {
  track: async (event: string, properties: Record<string, any> = {}) =>
    request(`${ANALYTICS_URL}/api/track`, {
      method: 'POST',
      body: JSON.stringify({ event, properties, timestamp: new Date().toISOString() }),
    }),
};

// Event Bus Operations
export const events = {
  publish: async (type: string, category: string, data: any, context: Record<string, any> = {}) =>
    request(`${EVENT_BUS_URL}/api/events`, {
      method: 'POST',
      body: JSON.stringify({ type, category, version: '1.0.0', source: 'SERVICE_NAME', data, ...context }),
    }),
};

export default { auth, wallet, notifications, analytics, events };
TEMPLATE
  sed -i '' "s/SERVICE_NAME/${service_name}/g" "$2/src/integrations/rabtulPlatform.ts"
}

# Template for rezIntelligence.ts
create_rez_intelligence() {
  local service_name=$1
  cat > "$2/src/integrations/rezIntelligence.ts" << 'TEMPLATE'
/**
 * REZ Intelligence Integration
 * Service: SERVICE_NAME
 */

const INTENT_URL = process.env.INTENT_SERVICE_URL || 'http://localhost:4018';
const PREDICT_URL = process.env.PREDICTIVE_ENGINE_URL || 'http://localhost:4123';
const SEGMENTS_URL = process.env.REALTIME_SEGMENTS_URL || 'http://localhost:4126';
const SIGNAL_URL = process.env.SIGNAL_AGGREGATOR_URL || 'http://localhost:4121';
const IDENTITY_URL = process.env.IDENTITY_URL || 'http://localhost:4050';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

async function request(url: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Intent Prediction
export const intent = {
  predict: async (userId: string, context?: Record<string, any>) =>
    request(`${INTENT_URL}/api/intent/predict`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, context }),
    }),
  captureSignal: async (signal: any) =>
    request(`${INTENT_URL}/api/intent/capture`, {
      method: 'POST',
      body: JSON.stringify(signal),
    }),
};

// Predictive Engine
export const predict = {
  churn: async (userId: string) =>
    request(`${PREDICT_URL}/api/predict/churn`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  ltv: async (userId: string) =>
    request(`${PREDICT_URL}/api/predict/ltv`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  conversion: async (userId: string) =>
    request(`${PREDICT_URL}/api/predict/conversion`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
};

// Realtime Segments
export const segments = {
  get: async (userId: string) =>
    request(`${SEGMENTS_URL}/api/segments/${userId}`),
  update: async (userId: string, segs: { name: string; score: number }[]) =>
    request(`${SEGMENTS_URL}/api/segments/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ segments: segs }),
    }),
};

// Signal Aggregator
export const signals = {
  record: async (signal: any) =>
    request(`${SIGNAL_URL}/api/signals`, {
      method: 'POST',
      body: JSON.stringify(signal),
    }),
  query: async (filters: any) =>
    request(`${SIGNAL_URL}/api/signals/query`, {
      method: 'POST',
      body: JSON.stringify(filters),
    }),
};

// Identity Graph
export const identity = {
  resolve: async (identifier: string, type: string) =>
    request(`${IDENTITY_URL}/api/identity/resolve`, {
      method: 'POST',
      body: JSON.stringify({ identifier, type }),
    }),
  getProfile: async (userId: string) =>
    request(`${IDENTITY_URL}/api/identity/${userId}/profile`),
};

export default { intent, predict, segments, signals, identity };
TEMPLATE
  sed -i '' "s/SERVICE_NAME/${service_name}/g" "$2/src/integrations/rezIntelligence.ts"
}

# Template for index.ts
create_index() {
  cat > "$1/src/integrations/index.ts" << 'TEMPLATE'
/**
 * Integrations Index
 */

export * from './rabtulPlatform';
export * from './rezIntelligence';
TEMPLATE
}

# Services to process
SERVICES=(
  "rez-retail-expert"
  "rez-fitness-expert"
  "rez-health-expert"
  "rez-hospitality-expert"
  "rez-travel-expert"
  "rez-education-expert"
  "rez-salon-expert"
  "rez-culinary-expert"
  "rez-fraud-agent"
  "rez-sales-agent"
  "rez-consultant-agent"
  "rez-info-agent"
  "rez-sms-bridge"
  "rez-email-bridge"
  "rez-rcs-bridge"
)

for service in "${SERVICES[@]}"; do
  if [ -d "$service/src" ]; then
    echo "Creating integrations for $service..."
    mkdir -p "$service/src/integrations"
    create_rabtul_platform "$service" "$service"
    create_rez_intelligence "$service" "$service"
    create_index "$service"
    echo "✅ $service done"
  fi
done

echo ""
echo "Batch integration complete!"
