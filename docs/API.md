# REZ Intelligence API Reference

**Version:** 1.0.0
**Base URL:** `https://rez-intelligence-hub.onrender.com`
**Authentication:** All endpoints require `X-Internal-Token` header

---

## Authentication

All API requests (except `/health` and `/ready`) must include the `X-Internal-Token` header:

```bash
curl -H "X-Internal-Token: your-internal-token" \
  https://rez-intelligence-hub.onrender.com/api/intent/active/user123
```

### Webhook Authentication

Webhook endpoints verify HMAC-SHA256 signatures:

```bash
X-Webhook-Signature: sha256=<signature>
X-Webhook-Timestamp: <unix-timestamp>
```

---

## Common Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `X-Internal-Token` | Yes | Service authentication |
| `X-Request-Id` | No | Request tracing ID |
| `X-Cron-Secret` | For cron | Cron job authentication |

---

## Health Endpoints

### GET /health

Service health check.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-12T10:30:00.000Z"
}
```

### GET /ready

Readiness check including dependencies.

**Response:**
```json
{
  "ready": true,
  "checks": {
    "database": true,
    "redis": true,
    "services": true
  }
}
```

---

## Intent Management

### POST /api/intent/capture

Capture a user intent signal.

**Request:**
```json
{
  "userId": "user_123",
  "category": "TRAVEL",
  "intentKey": "goa_beach_resort",
  "confidence": 0.85,
  "metadata": {
    "source": "hotel_search",
    "price": 2999,
    "location": "Goa"
  }
}
```

**Response:**
```json
{
  "success": true,
  "intentId": "intent_abc123",
  "status": "active"
}
```

### GET /api/intent/active/:userId

Get active intents for a user.

**Response:**
```json
{
  "success": true,
  "intents": [
    {
      "id": "intent_abc123",
      "userId": "user_123",
      "category": "TRAVEL",
      "intentKey": "goa_beach_resort",
      "confidence": 0.85,
      "createdAt": "2026-05-10T14:30:00.000Z",
      "lastActivity": "2026-05-12T09:15:00.000Z"
    }
  ],
  "count": 1
}
```

### GET /api/intent/dormant/:userId

Get dormant intents for revival.

**Response:**
```json
{
  "success": true,
  "dormantIntents": [
    {
      "id": "dormant_xyz789",
      "intentId": "intent_abc123",
      "category": "DINING",
      "intentKey": "italian_restaurant",
      "daysDormant": 12,
      "revivalScore": 0.65,
      "status": "pending"
    }
  ],
  "count": 1
}
```

### GET /api/intent/user/:userId

Get all intents (active and dormant) for a user.

**Response:**
```json
{
  "success": true,
  "userId": "user_123",
  "activeIntents": [...],
  "dormantIntents": [...],
  "stats": {
    "total": 15,
    "active": 8,
    "dormant": 7
  }
}
```

### POST /api/intent/revive

Trigger revival for a dormant intent.

**Request:**
```json
{
  "dormantIntentId": "dormant_xyz789",
  "triggerType": "price_drop",
  "triggerData": {
    "priceDropPct": 15
  }
}
```

**Response:**
```json
{
  "success": true,
  "revivalId": "revival_123",
  "nudgeQueued": true,
  "estimatedDelivery": "2026-05-12T18:00:00.000Z"
}
```

### POST /api/intent/trigger

Fire a revival trigger.

**Request:**
```json
{
  "userId": "user_123",
  "intentKey": "goa_beach_resort",
  "triggerType": "seasonality",
  "priority": "high"
}
```

**Response:**
```json
{
  "success": true,
  "triggerId": "trigger_456",
  "matchedIntents": 2
}
```

---

## Commerce Memory

### GET /api/commerce-memory/user/:userId

Get full enriched context for a user.

**Response:**
```json
{
  "success": true,
  "userId": "user_123",
  "activeIntents": [...],
  "dormantIntents": [...],
  "affinities": {
    "TRAVEL": 0.85,
    "DINING": 0.72,
    "RETAIL": 0.45
  },
  "recentActivity": [
    {
      "type": "search",
      "category": "TRAVEL",
      "timestamp": "2026-05-12T09:15:00.000Z"
    }
  ],
  "agentInsights": [
    {
      "agentId": "personalization-agent",
      "insight": "User prefers premium hotels",
      "timestamp": "2026-05-11T16:00:00.000Z"
    }
  ]
}
```

### GET /api/commerce-memory/affinity/:userId

Get user affinity profile.

**Response:**
```json
{
  "success": true,
  "userId": "user_123",
  "affinities": {
    "categories": {
      "TRAVEL": { "score": 0.85, "count": 45 },
      "DINING": { "score": 0.72, "count": 32 },
      "RETAIL": { "score": 0.45, "count": 18 }
    },
    "priceRange": {
      "min": 500,
      "max": 5000,
      "average": 2200
    },
    "locations": ["Mumbai", "Goa", "Bangalore"]
  },
  "lastUpdated": "2026-05-12T10:00:00.000Z"
}
```

### POST /api/commerce-memory/sync/:userId

Sync cross-app profile.

**Request:**
```json
{
  "source": "hotel_app",
  "profile": {
    "preferences": ["beach", "luxury"],
    "avgOrderValue": 3500
  }
}
```

**Response:**
```json
{
  "success": true,
  "synced": true,
  "enriched": true
}
```

### GET /api/commerce-memory/dashboard

Summary statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalUsers": 15420,
    "totalIntents": 89340,
    "activeIntents": 12450,
    "dormantIntents": 76890,
    "conversionRate": 0.085
  }
}
```

---

## Merchant Demand

### GET /api/merchant/:id/demand/dashboard

Complete demand dashboard for a merchant.

**Response:**
```json
{
  "success": true,
  "merchantId": "merchant_123",
  "categories": {
    "DINING": {
      "stats": {
        "totalIntents": 1250,
        "activeIntents": 340,
        "dormantIntents": 910,
        "recentActivity": 87
      },
      "signal": {
        "demandCount": 156,
        "unmetDemandPct": 28,
        "trend": "rising",
        "spikeDetected": false
      },
      "health": "good"
    }
  },
  "generatedAt": "2026-05-12T10:30:00.000Z"
}
```

### GET /api/merchant/:id/demand/signal

Real-time demand signal.

**Response:**
```json
{
  "success": true,
  "merchantId": "merchant_123",
  "signal": {
    "demandCount": 156,
    "unmetDemandPct": 28,
    "avgPriceExpectation": 299.50,
    "topCities": ["Mumbai", "Delhi", "Bangalore"],
    "trend": "rising",
    "spikeDetected": false,
    "timestamp": "2026-05-12T10:30:00.000Z"
  }
}
```

### GET /api/merchant/:id/procurement

Procurement recommendations.

**Query Parameters:**
- `category` (optional): Filter by category

**Response:**
```json
{
  "success": true,
  "merchantId": "merchant_123",
  "totalMarketDemand": 15000,
  "avgUnmetDemand": "35%",
  "gaps": [
    {
      "type": "expand_inventory",
      "priority": "high",
      "demandCount": 234,
      "unmetDemand": "45%",
      "action": "Consider expanding inventory to capture 234 unmet demand",
      "expectedCapture": "80% conversion if addressed"
    }
  ],
  "seasonality": [
    { "month": 12, "expectedDemand": "2250 (+80%)" }
  ]
}
```

### GET /api/merchant/:id/intents/top

Top performing intents.

**Response:**
```json
{
  "success": true,
  "merchantId": "merchant_123",
  "topIntents": [
    {
      "intentKey": "biryani",
      "category": "DINING",
      "demandCount": 523,
      "conversionRate": 0.12,
      "avgPrice": 299
    },
    {
      "intentKey": "pasta",
      "category": "DINING",
      "demandCount": 312,
      "conversionRate": 0.08,
      "avgPrice": 349
    }
  ]
}
```

### GET /api/merchant/:id/trends

Demand trends over time.

**Query Parameters:**
- `period`: 7d, 30d, 90d (default: 7d)
- `category`: Filter by category

**Response:**
```json
{
  "success": true,
  "merchantId": "merchant_123",
  "period": "7d",
  "summary": {
    "totalSignals": 3420,
    "avgPerBucket": "489",
    "trendDirection": "rising",
    "changePct": "+15%"
  },
  "trend": [
    {
      "time": "2026-04-21T00:00:00Z",
      "search": 120,
      "view": 180,
      "wishlist": 45,
      "cart": 15,
      "total": 360
    }
  ]
}
```

### GET /api/merchant/:id/locations

Demand by location.

**Query Parameters:**
- `category` (optional): Filter by category

**Response:**
```json
{
  "success": true,
  "merchantId": "merchant_123",
  "totalIntents": 1250,
  "locations": [
    { "rank": 1, "city": "Mumbai", "demandCount": 420, "demandPct": "33.6%" },
    { "rank": 2, "city": "Delhi", "demandCount": 380, "demandPct": "30.4%" },
    { "rank": 3, "city": "Bangalore", "demandCount": 290, "demandPct": "23.2%" }
  ]
}
```

### GET /api/merchant/:id/pricing

Price expectations analysis.

**Query Parameters:**
- `category` (optional): Filter by category

**Response:**
```json
{
  "success": true,
  "merchantId": "merchant_123",
  "priceExpectations": {
    "avgPrice": "299.50",
    "avgHighIntentPrice": "349.99",
    "sampleSize": 856,
    "recommendation": "Consider competitive pricing to capture high-intent users"
  }
}
```

### POST /api/merchant/:id/alerts

Configure demand alerts.

**Request:**
```json
{
  "category": "DINING",
  "threshold": 50,
  "webhookUrl": "https://merchant.example.com/webhooks/demand",
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "alertId": "alert_789",
  "createdAt": "2026-05-12T10:30:00.000Z"
}
```

---

## Webhook Endpoints

### POST /webhooks/hotel/search

Hotel search event webhook.

**Request:**
```json
{
  "userId": "user_123",
  "searchId": "search_abc",
  "destination": "Goa",
  "checkIn": "2026-06-15",
  "checkOut": "2026-06-20",
  "guests": 2,
  "timestamp": "2026-05-12T10:30:00.000Z"
}
```

### POST /webhooks/hotel/confirm

Hotel booking confirmation webhook.

**Request:**
```json
{
  "userId": "user_123",
  "bookingId": "booking_xyz",
  "hotelId": "hotel_456",
  "totalAmount": 12500,
  "timestamp": "2026-05-12T10:30:00.000Z"
}
```

### POST /webhooks/restaurant/view

Restaurant view webhook.

**Request:**
```json
{
  "userId": "user_123",
  "restaurantId": "restaurant_789",
  "category": "DINING",
  "timestamp": "2026-05-12T10:30:00.000Z"
}
```

### POST /webhooks/restaurant/order

Restaurant order webhook.

**Request:**
```json
{
  "userId": "user_123",
  "orderId": "order_abc",
  "restaurantId": "restaurant_789",
  "items": [
    { "itemId": "biryani", "quantity": 2, "price": 299 }
  ],
  "totalAmount": 750,
  "timestamp": "2026-05-12T10:30:00.000Z"
}
```

### POST /webhooks/nudge/delivered

Nudge delivery callback.

**Request:**
```json
{
  "nudgeId": "nudge_123",
  "userId": "user_456",
  "channel": "push",
  "deliveredAt": "2026-05-12T10:30:00.000Z"
}
```

### POST /webhooks/nudge/clicked

Nudge click callback.

**Request:**
```json
{
  "nudgeId": "nudge_123",
  "userId": "user_456",
  "clickedAt": "2026-05-12T10:35:00.000Z"
}
```

### POST /webhooks/nudge/converted

Nudge conversion callback.

**Request:**
```json
{
  "nudgeId": "nudge_123",
  "userId": "user_456",
  "conversionType": "order",
  "conversionValue": 1250,
  "convertedAt": "2026-05-12T10:40:00.000Z"
}
```

### POST /webhooks/batch/capture

Batch intent capture.

**Request:**
```json
{
  "events": [
    { "type": "search", "userId": "user_1", "category": "TRAVEL" },
    { "type": "view", "userId": "user_2", "category": "DINING" },
    { "type": "order", "userId": "user_3", "category": "RETAIL" }
  ],
  "batchId": "batch_abc",
  "timestamp": "2026-05-12T10:30:00.000Z"
}
```

---

## Agent Endpoints

### GET /api/agent/tools

List available agent tools.

**Response:**
```json
{
  "success": true,
  "tools": [
    {
      "name": "get_user_intents",
      "description": "Get active intents for personalization",
      "parameters": ["userId"]
    },
    {
      "name": "get_dormant_intents",
      "description": "Get dormant intents for revival",
      "parameters": ["userId"]
    },
    {
      "name": "get_enriched_context",
      "description": "Get comprehensive user context",
      "parameters": ["userId"]
    }
  ]
}
```

### POST /api/agent/tools/execute

Execute an agent tool.

**Request:**
```json
{
  "toolName": "get_enriched_context",
  "params": { "userId": "user_123" }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "activeIntents": [...],
    "dormantIntents": [...],
    "affinities": {...}
  }
}
```

### GET /api/agent/intents/:userId

Get active intents for agent use.

### GET /api/agent/dormant/:userId

Get dormant intents for agent use.

### GET /api/agent/enrich/:userId

Get enriched context for agent use.

### POST /api/agent/insight

Record agent insight.

**Request:**
```json
{
  "userId": "user_123",
  "agentId": "personalization-agent",
  "insight": "User prefers premium hotels on weekends"
}
```

### GET /api/services/health

Get health of all external services.

**Response:**
```json
{
  "success": true,
  "services": [
    { "name": "wallet", "healthy": true, "latency": 45 },
    { "name": "order", "healthy": true, "latency": 32 },
    { "name": "notification", "healthy": false, "latency": null }
  ]
}
```

---

## Autonomous Mode (Agent Server)

### POST /api/autonomous/start

Enable full autonomous mode.

**Response:**
```json
{
  "success": true,
  "mode": "autonomous",
  "enabledAt": "2026-05-12T10:30:00.000Z"
}
```

### POST /api/autonomous/stop

Disable autonomous mode.

### POST /api/autonomous/action

Execute a dangerous action.

**Request:**
```json
{
  "actionType": "adjust_price",
  "agentName": "scarcity-agent",
  "payload": {
    "merchantId": "m123",
    "adjustment": 10
  }
}
```

**Response:**
```json
{
  "success": true,
  "actionId": "action_789",
  "executedBy": "scarcity-agent"
}
```

### POST /api/autonomous/emergency-stop

Emergency stop for autonomous mode.

### GET /api/autonomous/status

Get autonomous mode status.

---

## Knowledge & Chat

### POST /api/knowledge

Create knowledge entry.

**Request:**
```json
{
  "category": "merchant",
  "entityId": "merchant_123",
  "knowledge": "Popular for weekend brunch",
  "confidence": 0.85
}
```

### GET /api/knowledge/search

Search knowledge base.

**Query Parameters:**
- `query`: Search query
- `category` (optional): Filter by category
- `limit` (optional): Max results (default: 10)

### POST /api/chat/message

Send chat message.

**Request:**
```json
{
  "userId": "user_123",
  "message": "What restaurants are popular near the beach?",
  "sessionId": "session_abc"
}
```

**Response:**
```json
{
  "success": true,
  "response": "Based on your preferences, I recommend...",
  "sessionId": "session_abc",
  "suggestions": [...]
}
```

### GET /api/chat/history/:userId

Get chat history.

---

## Monitoring

### GET /api/monitoring/health

Detailed health check.

**Response:**
```json
{
  "healthy": true,
  "checks": {
    "database": true,
    "redis": false,
    "services": true
  },
  "services": {
    "healthy": 5,
    "total": 6,
    "status": { "wallet": true, "order": true }
  },
  "uptime": 86400
}
```

### GET /api/monitoring/dashboard

Dashboard metrics.

**Response:**
```json
{
  "timestamp": 1746092400000,
  "uptime": 172800,
  "system": {
    "memoryUsageMB": 128.45,
    "sharedMemoryEntries": 1542
  },
  "intents": {
    "captured": 15420,
    "dormant": 342,
    "fulfilled": 890
  },
  "nudges": {
    "sent": 1234,
    "delivered": 1180,
    "clicked": 156,
    "converted": 45,
    "conversionRate": 3.65
  }
}
```

### GET /api/monitoring/metrics

Get all metrics.

### GET /api/monitoring/alerts

Get active alerts.

---

## WebSocket Events

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3005/ws');
```

### Subscribe to Channels

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'demand_signals',
  filter: { merchantId: 'merchant_123', category: 'DINING' }
}));
```

### Available Channels

| Channel | Description |
|---------|-------------|
| `demand_signals` | Real-time demand updates |
| `scarcity_alerts` | Inventory alerts |
| `nudge_events` | Nudge lifecycle events |
| `system_metrics` | Periodic metrics |
| `merchant_dashboard` | Dashboard updates |
| `user_intents` | User activity updates |

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_TOKEN` | 401 | Invalid or missing authentication token |
| `INVALID_SIGNATURE` | 401 | Invalid webhook signature |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVICE_UNAVAILABLE` | 503 | External service unavailable |
| `INTERNAL_ERROR` | 500 | Internal server error |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      { "field": "userId", "message": "Required" }
    ]
  }
}
```

---

## Rate Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Standard APIs | 100 req | per minute |
| Intent Capture | 1000 req | per minute |
| Agent Tools | 50 req | per minute |
| Webhooks | 5000 req | per minute |

---

## Appendix: Postman Collection

Import the following collection to test the API:

```json
{
  "info": {
    "name": "REZ Intelligence API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "https://rez-intelligence-hub.onrender.com"
    },
    {
      "key": "token",
      "value": "your-internal-token"
    }
  ],
  "auth": {
    "type": "apikey",
    "apikey": [
      {
        "key": "value",
        "value": "{{token}}",
        "key": "X-Internal-Token"
      }
    ]
  }
}
```
