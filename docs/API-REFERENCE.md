# REZ Intelligence Platform - API Reference

**Version:** 1.0.0
**Last Updated:** May 25, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Client Types](#client-types)
4. [Core Services](#core-services)
5. [AI/ML Services](#aiml-services)
6. [Tenant Isolation](#tenant-isolation)
7. [Rate Limits](#rate-limits)
8. [Error Handling](#error-handling)

---

## Overview

REZ Intelligence is an AI-powered platform for local commerce with:
- **170+ AI/ML services** across 12 companies
- **3 client types** with strict data isolation
- **Multi-tenant architecture** with privacy-first design
- **Real-time processing** for intent, predictions, and recommendations

### Base URLs

| Environment | URL |
|------------|-----|
| Local Dev | `http://localhost:4300` |
| Staging | `https://rez-intelligence-staging.onrender.com` |
| Production | `https://rez-intelligence-hub.onrender.com` |

---

## Authentication

### API Key Authentication

Include your API key in the `X-API-Key` header:

```bash
curl -X GET https://api.rez.money/v1/resource \
  -H "X-API-Key: your_api_key_here"
```

### Internal Service Authentication

For service-to-service calls, use the internal token:

```bash
curl -X GET http://rez-service:3000/internal \
  -H "X-Internal-Token: your_internal_token"
```

### API Key Format

| Client Type | Prefix | Example |
|-------------|--------|---------|
| REZ Ecosystem | `rez_` | `rez_acme_corp_123` |
| External/Non-REZ | `ext_` | `ext_partner_456` |
| RABTUL SaaS | `saas_` | `saas_reseller_789` |

---

## Client Types

### 1. REZ_ECOSYSTEM (`rez_*`)

**Full intelligence sharing within the REZ ecosystem.**

| Feature | Access |
|---------|--------|
| Intent signals | Full sharing |
| User graph | Universal |
| Merchant KB | Shared |
| Analytics | All levels |

**Use Cases:** REZ internal services, REZ App, ReZ Ride

### 2. NON_REZ (`ext_*`)

**Strict tenant isolation for external partners.**

| Feature | Access |
|---------|--------|
| Intent signals | Anonymized only |
| User graph | Isolated |
| Merchant KB | Strict isolation |
| Analytics | Aggregate only |

**Use Cases:** Partner integrations, white-label clients

### 3. RABTUL_SAAS (`saas_*`)

**Plugin-based SaaS with subscription billing.**

| Feature | Access |
|---------|--------|
| Intent signals | Configurable |
| User graph | Per-tenant |
| Merchant KB | White-label |
| Analytics | Per-merchant |

**Use Cases:** Resellers, enterprise SaaS, franchise systems

---

## Core Services

### REZ API Gateway (Port 4300)

**Unified entry point with tenant isolation and rate limiting.**

```bash
# Base URL
https://rez-api-gateway.rez.money
```

#### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/health` | Health check | None |
| GET | `/api/services` | List available services | API Key |
| GET | `/api/services/:service` | Service info | API Key |
| POST | `/api/intent/predict` | Predict user intent | API Key |
| POST | `/api/recommendations` | Get recommendations | API Key |
| GET | `/api/profile/:userId` | User profile | API Key |
| POST | `/api/events` | Track events | API Key |

#### Example Request

```bash
curl -X POST https://rez-api-gateway.rez.money/api/intent/predict \
  -H "Content-Type: application/json" \
  -H "X-API-Key: rez_your_tenant_123" \
  -d '{
    "userId": "user_abc123",
    "context": {
      "location": { "lat": 12.9716, "lng": 77.5946 },
      "time": { "hour": 19, "dayOfWeek": "friday" }
    }
  }'
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "userId": "user_abc123",
    "intents": [
      {
        "intent": "food_delivery",
        "confidence": 0.89,
        "category": "commerce",
        "urgency": "high"
      },
      {
        "intent": "dining_out",
        "confidence": 0.72,
        "category": "lifestyle",
        "urgency": "medium"
      }
    ],
    "context": {
      "location": "Bangalore, India",
      "weather": "clear"
    }
  }
}
```

---

### REZ Tenant Adapter (Port 4210)

**Multi-tenant isolation layer with privacy enforcement.**

```bash
# Base URL
http://localhost:4210
```

#### Tenant Management

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tenants` | Create tenant |
| GET | `/api/tenants` | List tenants |
| GET | `/api/tenants/:id` | Get tenant |
| PUT | `/api/tenants/:id` | Update tenant |

#### Knowledge Base (Tenant-isolated)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/knowledge/entries` | Add entry |
| GET | `/api/knowledge/search` | Search entries |
| GET | `/api/knowledge/entries` | List entries |
| POST | `/api/knowledge/import` | Bulk import |

#### Privacy Checks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/privacy/can-access` | Check cross-tenant access |
| POST | `/api/privacy/can-share-intent` | Check intent sharing |
| POST | `/api/privacy/filter` | Filter data by privacy |

#### Create Tenant Example

```bash
curl -X POST http://localhost:4210/api/tenants \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-internal-token" \
  -d '{
    "clientType": "REZ_ECOSYSTEM",
    "displayName": "Acme Corp",
    "industry": "retail",
    "merchantId": "acme_001"
  }'
```

#### Response

```json
{
  "success": true,
  "data": {
    "tenant": {
      "tenantId": "acme_001",
      "clientType": "REZ_ECOSYSTEM",
      "intelligenceLevel": "FULL",
      "dataIsolation": "shared",
      "createdAt": "2026-05-25T10:00:00Z"
    },
    "apiKey": "rez_acme_001_abc123xyz"
  },
  "message": "Tenant created. Save the API key securely - it will not be shown again."
}
```

---

### REZ Flow Runtime (Port 4200)

**Workflow execution engine with BullMQ job processing.**

```bash
# Base URL
http://localhost:4200
```

#### Workflows

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/workflows` | Create workflow |
| GET | `/api/workflows` | List workflows |
| GET | `/api/workflows/:id` | Get workflow |
| PUT | `/api/workflows/:id` | Update workflow |
| DELETE | `/api/workflows/:id` | Delete workflow |

#### Executions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/executions` | Trigger execution |
| GET | `/api/executions/:id` | Get execution |
| POST | `/api/executions/:id/cancel` | Cancel execution |
| POST | `/api/executions/:id/retry` | Retry execution |

#### Create Workflow

```bash
curl -X POST http://localhost:4200/api/workflows \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "name": "Order Confirmation Flow",
    "description": "Send confirmation after order",
    "entryNodeId": "send_email",
    "nodes": [
      {
        "id": "send_email",
        "type": "action_send_email",
        "config": {
          "actionType": "send_email",
          "params": {
            "to": "{{userEmail}}",
            "subject": "Order Confirmed!",
            "template": "order_confirmation"
          }
        }
      },
      {
        "id": "add_coins",
        "type": "action_add_coins",
        "config": {
          "actionType": "add_coins",
          "params": {
            "userId": "{{userId}}",
            "amount": 50,
            "reason": "order_reward"
          }
        }
      }
    ],
    "edges": [
      { "from": "send_email", "to": "add_coins", "condition": null }
    ]
  }'
```

#### Trigger Execution

```bash
curl -X POST http://localhost:4200/api/executions \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "workflowId": "order_confirmation_flow",
    "trigger": { "type": "event", "source": "order_service" },
    "variables": {
      "userId": "user_123",
      "userEmail": "user@example.com",
      "orderId": "order_456"
    }
  }'
```

#### Node Types

| Type | Category | Description |
|------|----------|-------------|
| `action_send_email` | Communication | Send email |
| `action_send_sms` | Communication | Send SMS |
| `action_send_whatsapp` | Communication | Send WhatsApp |
| `action_send_push` | Communication | Push notification |
| `action_add_coins` | Wallet | Add wallet coins |
| `action_deduct_coins` | Wallet | Deduct coins |
| `action_create_order` | Commerce | Create order |
| `condition_if_time` | Logic | Time-based branch |
| `condition_if_segment` | Logic | Segment-based branch |
| `delay_wait_hours` | Timing | Delay execution |
| `ai_analyze_sentiment` | AI | Sentiment analysis |
| `ai_generate_response` | AI | AI response generation |

---

## AI/ML Services

### REZ Intent Predictor (Port 4018)

**Predict user intent from context signals.**

```bash
# Base URL
http://localhost:4018
```

| Method | Path | Description |
|--------|------|-------------|
| POST | `/predict` | Predict intent |
| POST | `/batch-predict` | Batch predict |
| GET | `/intents` | Available intent types |
| POST | `/feedback` | Submit intent feedback |

#### Predict Intent

```bash
curl -X POST http://localhost:4018/predict \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "userId": "user_123",
    "context": {
      "location": { "lat": 12.9716, "lng": 77.5946 },
      "time": { "hour": 12, "dayOfWeek": "monday" },
      "device": "mobile",
      "recentSearches": ["biryani", "pizza"],
      "recentCategories": ["food", "restaurants"]
    }
  }'
```

#### Response

```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "primaryIntent": {
      "intent": "food_ordering",
      "confidence": 0.92,
      "urgency": "high",
      "estimatedBudget": { "min": 200, "max": 800 }
    },
    "secondaryIntents": [
      { "intent": "restaurant_search", "confidence": 0.78 },
      { "intent": "food_reviews", "confidence": 0.45 }
    ],
    "contextFactors": [
      { "factor": "time_of_day", "influence": "positive", "value": "lunch_time" },
      { "factor": "recent_searches", "influence": "positive", "value": "food_related" }
    ],
    "modelVersion": "v2.3.1",
    "processingTimeMs": 45
  }
}
```

---

### REZ Predictive Engine (Port 4141)

**Churn, LTV, and revisit predictions.**

```bash
# Base URL
http://localhost:4141
```

| Method | Path | Description |
|--------|------|-------------|
| POST | `/predict/churn` | Churn probability |
| POST | `/predict/ltv` | Lifetime value |
| POST | `/predict/revisit` | Revisit probability |
| POST | `/predict/conversion` | Conversion likelihood |
| GET | `/segments/:userId` | User segments |

#### Churn Prediction

```bash
curl -X POST http://localhost:4141/predict/churn \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "userId": "user_123",
    "lookbackDays": 30,
    "features": {
      "lastOrderDate": "2026-05-20",
      "orderFrequency": "weekly",
      "avgOrderValue": 450,
      "supportTickets": 1
    }
  }'
```

#### Response

```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "churnRisk": {
      "probability": 0.23,
      "level": "low",
      "factors": [
        { "name": "order_frequency", "contribution": 0.15, "direction": "negative" },
        { "name": "recent_engagement", "contribution": -0.08, "direction": "positive" }
      ]
    },
    "recommendedActions": [
      {
        "action": "send_reengagement_offer",
        "priority": "high",
        "expectedLift": 0.3
      },
      {
        "action": "personalized_recommendation",
        "priority": "medium",
        "expectedLift": 0.15
      }
    ],
    "modelVersion": "churn_v3.1.0",
    "processingTimeMs": 120
  }
}
```

---

### REZ Care Service (Port 4058)

**Customer support intelligence with proactive detection.**

```bash
# Base URL
http://localhost:4058
```

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tickets` | List support tickets |
| POST | `/tickets` | Create ticket |
| GET | `/tickets/:id` | Get ticket |
| POST | `/tickets/:id/escalate` | Escalate ticket |
| POST | `/feedback` | Submit CSAT feedback |
| GET | `/customer-360/:userId` | Customer 360 view |

#### Customer 360

```bash
curl -X GET http://localhost:4058/customer-360/user_123 \
  -H "X-Internal-Token: your-token"
```

#### Response

```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "profile": {
      "totalOrders": 127,
      "lifetimeValue": 45600,
      "memberSince": "2024-03-15",
      "tier": "gold"
    },
    "sentiment": {
      "score": 0.78,
      "trend": "improving",
      "lastInteraction": "2026-05-24"
    },
    "openTickets": 1,
    "csat": {
      "average": 4.2,
      "totalResponses": 45
    },
    "riskIndicators": [
      { "type": "churn_risk", "level": "low" },
      { "type": "support_frequency", "level": "normal" }
    ],
    "insights": [
      "High-value customer with consistent orders",
      "Prefers chat support over email"
    ]
  }
}
```

---

### REZ Memory Layer (Port 4201)

**Customer timeline and preference aggregation.**

```bash
# Base URL
http://localhost:4201
```

| Method | Path | Description |
|--------|------|-------------|
| POST | `/timeline/event` | Add timeline event |
| GET | `/timeline/:userId` | Get user timeline |
| GET | `/preferences/:userId` | Get preferences |
| POST | `/preferences/:userId` | Update preferences |
| GET | `/segments/:userId` | Get user segments |

#### Add Timeline Event

```bash
curl -X POST http://localhost:4201/timeline/event \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "userId": "user_123",
    "eventType": "order_completed",
    "timestamp": "2026-05-25T14:30:00Z",
    "data": {
      "orderId": "order_789",
      "restaurant": "Biryani Palace",
      "total": 450,
      "items": ["chicken_biryani", "naan"]
    }
  }'
```

#### Get Timeline

```bash
curl -X GET "http://localhost:4201/timeline/user_123?limit=50&type=order" \
  -H "X-Internal-Token: your-token"
```

---

### REZ Knowledge Graph (Port 4060)

**Knowledge graph with merchant and product relationships.**

```bash
# Base URL
http://localhost:4060
```

| Method | Path | Description |
|--------|------|-------------|
| POST | `/entities` | Create entity |
| GET | `/entities/:id` | Get entity |
| GET | `/search` | Search entities |
| POST | `/relationships` | Create relationship |
| GET | `/graph/:entityId` | Get entity graph |

#### Create Entity

```bash
curl -X POST http://localhost:4060/entities \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-tenant-key" \
  -d '{
    "type": "restaurant",
    "name": "Spice Garden",
    "properties": {
      "cuisine": "north_indian",
      "priceRange": "medium",
      "rating": 4.5,
      "location": {
        "address": "123 Main St, Bangalore",
        "lat": 12.9716,
        "lng": 77.5946
      }
    },
    "metadata": {
      "merchantId": "merchant_001",
      "tenantId": "rez_internal"
    }
  }'
```

---

### REZ WhatsApp (Port 4202)

**Unified WhatsApp Business API integration.**

```bash
# Base URL
http://localhost:4202
```

| Method | Path | Description |
|--------|------|-------------|
| POST | `/send` | Send message |
| POST | `/send-template` | Send template message |
| GET | `/messages/:sessionId` | Get messages |
| POST | `/webhook` | WhatsApp webhook |

#### Send Message

```bash
curl -X POST http://localhost:4202/send \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "to": "+919876543210",
    "type": "text",
    "content": {
      "body": "Your order #12345 is ready for pickup!"
    }
  }'
```

---

## Tenant Isolation

### Data Isolation Rules

| Data Type | REZ_ECOSYSTEM | NON_REZ | RABTUL_SAAS |
|-----------|---------------|---------|-------------|
| User profiles | Shared | Isolated | Per-tenant |
| Intent signals | Full | Anonymized | Configurable |
| Merchant KB | Shared | Strict | White-label |
| Analytics | All | Aggregate | Per-merchant |
| Cross-tenant access | Allowed | Denied | Denied |

### Privacy Filter

Data is automatically filtered based on tenant type:

```bash
# NON_REZ tenant receives filtered data
curl -X POST http://localhost:4210/api/privacy/filter \
  -H "X-API-Key: ext_partner_456" \
  -d '{
    "user": {
      "id": "user_123",
      "email": "user@example.com",  # Will be filtered
      "phone": "+919876543210",      # Will be filtered
      "name": "John Doe"
    }
  }'
```

#### Response (filtered)

```json
{
  "success": true,
  "data": {
    "filtered": {
      "id": "user_123",
      "name": "John Doe"
    }
  }
}
```

---

## Rate Limits

| Tier | Requests/minute | Burst |
|------|-----------------|-------|
| Free | 60 | 10 |
| Pro | 600 | 100 |
| Enterprise | 6000 | 1000 |

Rate limit headers:
- `X-RateLimit-Limit`: Max requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

---

## Error Handling

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

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | `{"success": true}` |
| 400 | Validation Error | Missing required field |
| 401 | Unauthorized | Invalid API key |
| 403 | Forbidden | Tenant not allowed |
| 404 | Not Found | Resource doesn't exist |
| 429 | Rate Limited | Too many requests |
| 500 | Server Error | Internal failure |
| 503 | Service Unavailable | Service down |

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `UNAUTHORIZED` | Invalid or missing auth |
| `FORBIDDEN` | Access denied |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMITED` | Rate limit exceeded |
| `SERVICE_UNAVAILABLE` | Downstream service error |
| `TENANT_ISOLATED` | Cross-tenant access denied |
| `INVALID_API_KEY` | Malformed API key |

---

## SDK Examples

### TypeScript

```typescript
import { REZIntelligence } from '@rez/intelligence-sdk';

const client = new REZIntelligence({
  apiKey: process.env.REZ_API_KEY,
  baseUrl: 'https://rez-api-gateway.rez.money'
});

// Predict intent
const prediction = await client.intent.predict({
  userId: 'user_123',
  context: { location: { lat: 12.97, lng: 77.59 } }
});

// Get recommendations
const recs = await client.recommendations.getForUser('user_123', {
  limit: 10,
  categories: ['food', 'restaurants']
});
```

### Python

```python
from rez_intelligence import REZIntelligence

client = REZIntelligence(api_key="your-api-key")

# Predict intent
prediction = client.intent.predict(
    user_id="user_123",
    context={"location": {"lat": 12.97, "lng": 77.59}}
)

# Get recommendations
recs = client.recommendations.get_for_user("user_123", limit=10)
```

### cURL

```bash
# Set variables
API_KEY="your-api-key"
BASE_URL="https://rez-api-gateway.rez.money"

# Health check
curl -X GET "$BASE_URL/health"

# Predict intent
curl -X POST "$BASE_URL/api/intent/predict" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_123", "context": {}}'
```

---

## Support

- **Documentation:** https://docs.rez.money
- **API Status:** https://status.rez.money
- **Support:** support@rez.money
