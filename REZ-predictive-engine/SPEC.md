# REZ Predictive Engine - SPEC.md

**Version:** 1.0.0
**Port:** 4141
**Company:** REZ-Intelligence
**Category:** AI Predictions

---

## Overview

AI predictions for customer behavior including churn likelihood, lifetime value (LTV), next purchase timing, revisit probability, and conversion likelihood. Uses ML models for accurate forecasting.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REZ Predictive Engine (4141)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Prediction Services:                                                       │
│  ├── Churn Predictor     → Churn probability (0-1)                         │
│  ├── LTV Predictor       → Customer lifetime value                          │
│  ├── Revisit Predictor   → Return probability & timing                     │
│  └── Conversion Predictor → Conversion likelihood                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Models: ChurnPrediction, LTVPrediction, RevisitPrediction                  │
│  Routes: /predict/*, /ml/*                                                │
│  Auth: X-Internal-Token header required                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Prediction Types

### Churn Prediction

Predicts likelihood of customer churn (no purchase in X days).

**Endpoint:** `GET /predict/:userId/churn`

**Response:**
```json
{
  "userId": "user_123",
  "churnProbability": 0.35,
  "riskLevel": "medium",
  "daysUntilChurn": 45,
  "factors": {
    "lastPurchaseDays": 30,
    "purchaseFrequency": 0.8,
    "engagementScore": 0.65,
    "supportTickets": 2
  },
  "recommendedActions": [
    "Send win-back offer",
    "Personalized recommendations",
    "Push notification"
  ],
  "model": "churn-v2",
  "confidence": 0.87,
  "computedAt": "2026-05-20T10:30:00Z"
}
```

### LTV Prediction

Predicts customer lifetime value based on history and behavior.

**Endpoint:** `GET /predict/:userId/ltv`

**Response:**
```json
{
  "userId": "user_123",
  "ltv": {
    "predicted": 12500,
    "confidence": 0.82,
    "confidenceRange": {
      "low": 10000,
      "high": 15000
    },
    "timeHorizon": "12m"
  },
  "segments": {
    "currentTier": "gold",
    "predictedTier": "platinum",
    "upgradeProbability": 0.45
  },
  "factors": {
    "avgOrderValue": 850,
    "purchaseFrequency": 0.12,
    "retentionRate": 0.85,
    "categoryDiversity": 5
  },
  "model": "ltv-v3",
  "computedAt": "2026-05-20T10:30:00Z"
}
```

### Revisit Prediction

Predicts when customer will return and revisit probability.

**Endpoint:** `GET /predict/:userId/revisit`

**Response:**
```json
{
  "userId": "user_123",
  "revisitProbability": 0.78,
  "expectedReturnDate": "2026-05-25",
  "daysUntilReturn": 5,
  "confidence": 0.81,
  "factors": {
    "avgDaysBetweenVisits": 7,
    "categoryAffinity": 0.92,
    "seasonalityFactor": 1.2,
    "recentEngagement": 0.88
  },
  "optimalWindow": {
    "start": "2026-05-23",
    "end": "2026-05-27",
    "probability": 0.65
  },
  "model": "revisit-v2",
  "computedAt": "2026-05-20T10:30:00Z"
}
```

### Conversion Prediction

Predicts likelihood of specific conversion events.

**Endpoint:** `GET /predict/:userId/conversion`

**Request Body (optional):**
```json
{
  "targetType": "purchase",
  "targetId": "offer_456",
  "context": {
    "channel": "push",
    "timeOfDay": "evening",
    "dayOfWeek": "friday"
  }
}
```

**Response:**
```json
{
  "userId": "user_123",
  "conversionProbability": 0.72,
  "targetType": "purchase",
  "confidence": 0.85,
  "factors": {
    "historicalConversionRate": 0.65,
    "offerAffinity": 0.88,
    "priceSensitivity": 0.42,
    "timingScore": 0.78
  },
  "recommendedOffer": {
    "type": "percentage",
    "value": 15,
    "minPurchase": 500
  },
  "model": "conversion-v2",
  "computedAt": "2026-05-20T10:30:00Z"
}
```

---

## Batch Predictions

### GET /predict/:userId/all

Get all predictions in single request.

**Response:**
```json
{
  "userId": "user_123",
  "predictions": {
    "churn": { "probability": 0.35, "riskLevel": "medium" },
    "ltv": { "predicted": 12500 },
    "revisit": { "probability": 0.78, "daysUntilReturn": 5 },
    "conversion": { "probability": 0.72 }
  },
  "segments": ["high-value", "engaged"],
  "computedAt": "2026-05-20T10:30:00Z"
}
```

### POST /predict/batch

Submit batch prediction job.

**Request:**
```json
{
  "userIds": ["user_123", "user_456", "user_789"],
  "predictions": ["churn", "ltv", "revisit"],
  "priority": "normal"
}
```

**Response:**
```json
{
  "jobId": "batch_abc123",
  "status": "queued",
  "estimatedCompletion": "2026-05-20T10:35:00Z"
}
```

---

## Segment Predictions

### GET /predict/segments/at-risk

Get all users at risk of churning.

**Response:**
```json
{
  "segment": "at-risk",
  "totalUsers": 245,
  "users": [
    {
      "userId": "user_123",
      "churnProbability": 0.85,
      "lastActive": "2026-05-15"
    }
  ],
  "recommendations": [
    "Send urgent win-back campaign",
    "Personal outreach"
  ]
}
```

### GET /predict/segments/high-value

Get high-value customer predictions.

**Response:**
```json
{
  "segment": "high-value",
  "totalUsers": 1234,
  "ltvSummary": {
    "avgLTV": 15000,
    "totalValue": 18510000
  },
  "churnRisk": {
    "low": 980,
    "medium": 200,
    "high": 54
  }
}
```

---

## Risk Levels

| Level | Probability Range | Action |
|-------|-------------------|--------|
| `critical` | 0.80 - 1.0 | Immediate intervention |
| `high` | 0.60 - 0.79 | Urgent win-back |
| `medium` | 0.40 - 0.59 | Targeted offers |
| `low` | 0.20 - 0.39 | Monitor |
| `safe` | 0.0 - 0.19 | Standard engagement |

---

## Data Models

### ChurnPrediction

```typescript
interface ChurnPrediction {
  userId: string;
  churnProbability: number;    // 0-1
  riskLevel: RiskLevel;
  daysUntilChurn: number;
  factors: ChurnFactors;
  recommendedActions: string[];
  model: string;
  confidence: number;
  computedAt: Date;
}
```

### LTVPrediction

```typescript
interface LTVPrediction {
  userId: string;
  ltv: {
    predicted: number;
    confidence: number;
    confidenceRange: { low: number; high: number };
    timeHorizon: string;
  };
  segments: {
    currentTier: string;
    predictedTier: string;
    upgradeProbability: number;
  };
  factors: LTVFactors;
  model: string;
  computedAt: Date;
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "winston": "^3.11.0",
  "zod": "^3.22.4",
  "helmet": "^7.1.0",
  "uuid": "^9.0.1"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4141 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-predictive-engine | MongoDB |
| `NODE_ENV` | development | Environment |
| `RATE_LIMIT_WINDOW_MS` | 60000 | Rate limit window |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Max requests per window |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| Signal Aggregator | Read | Get user signals |
| Unified Profile | Read | User data |
| Commerce Graph | Write | Sync predictions |
| Recommendation Engine | Read | Personalization context |
| Notification Service | Trigger | Send predictions |

---

## Status

- [x] Churn prediction
- [x] LTV prediction
- [x] Revisit prediction
- [x] Conversion prediction
- [x] Batch predictions
- [x] Segment queries
- [x] ML model framework
- [ ] Model auto-retraining
- [ ] A/B testing for models
- [ ] Commerce graph sync
