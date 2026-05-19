# REZ-Intelligence Commerce Graph Connection Audit
**Date:** May 19, 2026

---

## Executive Summary

| Service | Connected to Commerce Graph | Action Needed |
|----------|---------------------------|--------------|
| REZ-identity-graph | ❌ | Add connection |
| REZ-signal-aggregator | ❌ | Add connection |
| REZ-predictive-engine | ❌ | Add connection |
| REZ-unified-attribution | ❌ | Add connection |
| REZ-recommendation-engine | ❌ | Add connection |
| REZ-merchant-intelligence | ❌ | Add connection |
| REZ-dooh-intelligence | ❌ | Add connection |
| REZ-location-intelligence | ❌ | Add connection |
| REZ-commerce-agents | ❌ | Add connection |
| REZ-care-service | ❌ | Add connection |
| **REZ-unified-commerce-graph** | ✅ | Central hub |
| **REZ-unified-ad-decision** | ✅ | Uses graph |

---

## Connection Matrix

### Should Connect TO Commerce Graph

| Service | Data to Send | Data to Receive |
|---------|-------------|-----------------|
| **REZ-identity-graph** | Identity updates | Customer profiles |
| **REZ-signal-aggregator** | Behavioral signals | Moment triggers |
| **REZ-predictive-engine** | Predictions (churn, LTV) | Training data |
| **REZ-unified-attribution** | Attribution data | Attribution results |
| **REZ-recommendation-engine** | Recommendation metrics | User preferences |
| **REZ-merchant-intelligence** | Merchant metrics | Merchant data |
| **REZ-dooh-intelligence** | DOOH events | DOOH analytics |
| **REZ-location-intelligence** | Location patterns | Nearby offers |
| **REZ-commerce-agents** | Agent actions | Cross-sell triggers |
| **REZ-care-service** | Support events | Customer context |

### Should Connect FROM Commerce Graph

| Service | Data to Receive |
|---------|-----------------|
| REZ-ads-service | Ad decisions |
| REZ-dsp-portal | Campaign data |
| REZ-decision-service | Decision context |
| buzzlocal-merchant-offer | Location offers |

---

## Detailed Connection Plan

### 1. REZ-identity-graph → Commerce Graph

```typescript
// Add to REZ-identity-graph/src/services/identity-sync.ts

import axios from 'axios';

const COMMERCE_GRAPH_URL = process.env.COMMERCE_GRAPH_URL || 'http://localhost:4170';

/**
 * Sync identity updates to Commerce Graph
 */
async function syncIdentityUpdate(userId: string, data: IdentityUpdate) {
  // Send customer node updates
  await axios.patch(`${COMMERCE_GRAPH_URL}/api/customers/${userId}`, {
    $set: {
      'segments': data.segments,
      'tier': data.tier,
      'lifetimeValue': data.lifetimeValue,
      'interests': data.interests,
    }
  }, {
    headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN }
  });
}
```

### 2. REZ-signal-aggregator → Commerce Graph

```typescript
// Add to REZ-signal-aggregator/src/services/signal-sync.ts

const COMMERCE_GRAPH_URL = process.env.COMMERCE_GRAPH_URL || 'http://localhost:4170';

/**
 * Send behavioral signals to Commerce Graph
 */
async function syncSignals(userId: string, signals: Signal[]) {
  await axios.post(`${COMMERCE_GRAPH_URL}/api/signals`, {
    userId,
    signals,
    timestamp: new Date()
  }, {
    headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN }
  });
}
```

### 3. REZ-predictive-engine → Commerce Graph

```typescript
// Add to REZ-predictive-engine/src/services/prediction-sync.ts

const COMMERCE_GRAPH_URL = process.env.COMMERCE_GRAPH_URL || 'http://localhost:4170';

/**
 * Sync predictions to Commerce Graph
 */
async function syncPredictions(userId: string, predictions: Predictions) {
  await axios.patch(`${COMMERCE_GRAPH_URL}/api/customers/${userId}/predictions`, {
    churnRisk: predictions.churnRisk,
    ltvScore: predictions.ltvScore,
    revisitProbability: predictions.revisitProbability,
    spendProbability: predictions.spendProbability
  }, {
    headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN }
  });
}
```

### 4. REZ-unified-attribution → Commerce Graph

```typescript
// Add to REZ-unified-attribution/src/services/attribution-sync.ts

const COMMERCE_GRAPH_URL = process.env.COMMERCE_GRAPH_URL || 'http://localhost:4170';

/**
 * Sync attribution data to Commerce Graph
 */
async function syncAttribution(transaction: AttributionTransaction) {
  await axios.post(`${COMMERCE_GRAPH_URL}/api/transactions`, {
    customerId: transaction.userId,
    merchantId: transaction.merchantId,
    transactionId: transaction.id,
    type: 'purchase',
    amount: transaction.amount,
    category: transaction.category,
    attributionChannel: transaction.attributionChannel,
    campaignId: transaction.campaignId,
    timestamp: transaction.timestamp
  }, {
    headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN }
  });
}
```

### 5. REZ-recommendation-engine → Commerce Graph

```typescript
// Add to REZ-recommendation-engine/src/services/recommendation-sync.ts

const COMMERCE_GRAPH_URL = process.env.COMMERCE_GRAPH_URL || 'http://localhost:4170';

/**
 * Sync recommendation metrics
 */
async function syncRecommendationMetrics(userId: string, metrics: RecommendationMetrics) {
  await axios.post(`${COMMERCE_GRAPH_URL}/api/events`, {
    customerId: userId,
    eventType: 'recommendation_viewed',
    data: metrics,
    timestamp: new Date()
  }, {
    headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN }
  });
}
```

### 6. REZ-merchant-intelligence → Commerce Graph

```typescript
// Add to REZ-merchant-intelligence/src/services/merchant-sync.ts

const COMMERCE_GRAPH_URL = process.env.COMMERCE_GRAPH_URL || 'http://localhost:4170';

/**
 * Sync merchant data to Commerce Graph
 */
async function syncMerchantData(merchantId: string, data: MerchantData) {
  await axios.patch(`${COMMERCE_GRAPH_URL}/api/merchants/${merchantId}`, {
    $set: {
      'metrics.totalRevenue': data.totalRevenue,
      'metrics.totalOrders': data.totalOrders,
      'metrics.avgOrderValue': data.avgOrderValue,
      'metrics.totalCustomers': data.totalCustomers,
      'metrics.repeatCustomerRate': data.repeatCustomerRate,
      'offers.active': data.activeOffers,
      'offers.avgCashback': data.avgCashback
    }
  }, {
    headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN }
  });
}
```

### 7. REZ-location-intelligence → Commerce Graph

```typescript
// Add to REZ-location-intelligence/src/services/location-sync.ts

const COMMERCE_GRAPH_URL = process.env.COMMERCE_GRAPH_URL || 'http://localhost:4170';

/**
 * Sync location patterns
 */
async function syncLocationPattern(userId: string, pattern: LocationPattern) {
  await axios.post(`${COMMERCE_GRAPH_URL}/api/location/patterns`, {
    customerId: userId,
    patterns: pattern,
    timestamp: new Date()
  }, {
    headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN }
  });
}
```

### 8. REZ-commerce-agents → Commerce Graph

```typescript
// Add to REZ-commerce-agents/src/services/agent-sync.ts

const COMMERCE_GRAPH_URL = process.env.COMMERCE_GRAPH_URL || 'http://localhost:4170';

/**
 * Sync cross-sell actions
 */
async function syncCrossSellAction(action: CrossSellAction) {
  await axios.post(`${COMMERCE_GRAPH_URL}/api/cross-sell/actions`, {
    customerId: action.userId,
    fromMerchantId: action.fromMerchant,
    toMerchantId: action.toMerchant,
    category: action.category,
    conversion: action.converted,
    timestamp: new Date()
  }, {
    headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN }
  });
}
```

---

## Environment Variables Needed

Add to each service:

```bash
# Commerce Graph Connection
COMMERCE_GRAPH_URL=http://localhost:4170
AD_DECISION_URL=http://localhost:4180
SPEND_PREDICTOR_URL=http://localhost:4147

# Auth
INTERNAL_SERVICE_TOKEN=your-token
```

---

## Priority Order

| Priority | Service | Effort | Impact |
|----------|---------|--------|--------|
| 1 | REZ-identity-graph | Low | High |
| 2 | REZ-signal-aggregator | Low | High |
| 3 | REZ-predictive-engine | Low | High |
| 4 | REZ-unified-attribution | Medium | High |
| 5 | REZ-merchant-intelligence | Medium | Medium |
| 6 | REZ-location-intelligence | Medium | Medium |
| 7 | REZ-recommendation-engine | Medium | Medium |
| 8 | REZ-commerce-agents | Medium | High |
| 9 | REZ-dooh-intelligence | Medium | Medium |
| 10 | REZ-care-service | Low | Medium |

---

## Status

| Item | Status |
|------|--------|
| Commerce Graph created | ✅ |
| Ad Decision created | ✅ |
| Spend Predictor created | ✅ |
| ReZ Ride connected | ✅ |
| REZ-Intelligence → Graph | ⏳ PENDING |
| REZ-Media → Graph | ⏳ PENDING |

---

## Next Steps

1. Add `commerceSync.ts` to each service
2. Add environment variables
3. Test end-to-end flow
4. Deploy and monitor
