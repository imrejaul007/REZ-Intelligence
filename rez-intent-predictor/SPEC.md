# REZ Intent Predictor - SPEC.md

**Version:** 1.0.0
**Port:** 4018
**Company:** REZ-Intelligence
**Category:** AI Predictions

---

## Overview

Real-time user intent prediction service for the REZ platform. Analyzes user behavior signals to predict purchase intent, enabling personalized interventions and optimized marketing.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Intent Predictor (4018)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Intent Detection:                                                          │
│  ├── Search query analysis                                               │
│  ├── Browse history patterns                                            │
│  ├── Cart behavior signals                                               │
│  ├── Session context (UTM, referrer)                                     │
│  └── Price sensitivity indicators                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Intent Categories:                                                        │
│  ├── Ready to Buy                                                        │
│  ├── Just Browsing                                                       │
│  ├── Research Mode                                                       │
│  ├── Deal Hunting                                                        │
│  ├── Loyalty Checking                                                    │
│  ├── Cart Abandonment Risk                                               │
│  └── High Value Opportunity                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /intent/*                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Intent Categories

| Category | Priority | Description |
|----------|----------|-------------|
| `ready_to_buy` | high | User ready to purchase |
| `just_browsing` | low | Casual browsing |
| `research_mode` | medium | Comparing options |
| `deal_hunting` | medium | Looking for discounts |
| `loyalty_checking` | medium | Checking rewards/points |
| `cart_abandonment_risk` | high | May abandon cart |
| `reactivation_needed` | medium | Dormant user |
| `high_value_opportunity` | high | Premium user signal |

---

## Input Signals

| Signal | Type | Description |
|--------|------|-------------|
| `search_queries` | array | User search terms |
| `browse_history` | array | Pages/products viewed |
| `cart_behavior` | object | Cart add/remove/value |
| `time_on_page` | map | Time per page |
| `scroll_depth` | map | Scroll percentages |
| `device_type` | string | mobile/tablet/desktop |
| `session_context` | object | UTM/referrer data |
| `repeated_views` | map | Product view counts |
| `price_sensitivity` | object | Deal-seeking indicators |

---

## API Endpoints

### POST /intent/score

Real-time intent scoring.

**Request:**
```json
{
  "userId": "user_123",
  "sessionId": "sess_abc123",
  "signals": {
    "search_queries": ["wireless headphones", "Sony earbuds"],
    "browse_history": ["prod_123", "prod_456"],
    "cart_behavior": {
      "itemsAdded": 2,
      "totalValue": 5998,
      "abandoned": false
    },
    "repeated_views": { "prod_123": 3 },
    "price_sensitivity": { "usedCoupons": 2 }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "primaryIntent": "ready_to_buy",
    "confidence": 0.85,
    "allIntents": [
      { "intent": "ready_to_buy", "score": 0.85 },
      { "intent": "deal_hunting", "score": 0.42 }
    ],
    "recommendedActions": [
      {
        "action": "send_checkout_reminder",
        "priority": "high",
        "cooldownHours": 1
      }
    ]
  }
}
```

### GET /intent/user/:id/profile

Get user intent profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "intentHistory": [
      { "intent": "research_mode", "timestamp": "2026-05-19T14:00:00Z" },
      { "intent": "ready_to_buy", "timestamp": "2026-05-20T10:30:00Z" }
    ],
    "preferredCategories": ["electronics", "fashion"],
    "avgSessionIntent": "research_mode",
    "conversionRate": 0.45
  }
}
```

### POST /intent/optimize

Optimize intent detection model.

**Request:**
```json
{
  "feedback": [
    { "signals": {...}, "actualIntent": "ready_to_buy", "predictedIntent": "just_browsing" }
  ]
}
```

### POST /intent/event

Record real-time event.

**Request:**
```json
{
  "userId": "user_123",
  "eventType": "page_view",
  "eventData": {
    "productId": "prod_123",
    "timeSpent": 45,
    "scrollDepth": 0.8
  }
}
```

### GET /intent/session/:id

Session analysis.

### POST /intent/batch-score

Batch intent scoring.

**Request:**
```json
{
  "users": [
    { "userId": "user_123", "signals": {...} },
    { "userId": "user_456", "signals": {...} }
  ]
}
```

---

## Push Triggers

| Intent | Trigger | Cooldown |
|--------|---------|----------|
| `high_value_opportunity` | intent === high_value_opportunity | 4 hours |
| `cart_abandonment_risk` | intent === cart_abandonment_risk AND no_activity_hours > 2 | 1 hour |
| `reactivation_needed` | intent === reactivation_needed AND days_since < 30 | 24 hours |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "cors": "^2.8.5"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4018 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-intent | MongoDB |
| `CORS_ORIGINS` | rez.money,admin.rez.money | Allowed origins |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| Signal Aggregator | Write | Emit intent signals |
| Notification Service | Trigger | Push notifications |
| Recommendation Engine | Read | Personalization context |
| Commerce Graph | Write | Sync intent data |

---

## Status

- [x] Real-time intent scoring
- [x] User intent profiles
- [x] Session analysis
- [x] Batch scoring
- [x] Push trigger integration
- [x] Intent documentation endpoints
- [ ] Model optimization feedback
- [ ] Commerce graph sync
