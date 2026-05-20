# REZ AI Orchestrator - SPEC.md

**Version:** 1.0.0
**Port:** 4101
**Company:** REZ-Intelligence
**Category:** AI Orchestration

---

## Overview

Central AI coordination service that routes requests to specialized AI services across the REZ ecosystem. Provides unified access to prediction, recommendation, personalization, and analysis capabilities.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ AI Orchestrator (4101)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Responsibilities:                                                      │
│  ├── Request Routing    → Direct to specialized AI services               │
│  ├── Service Discovery  → Track available AI endpoints                     │
│  ├── Response Aggregation → Combine multi-service responses                │
│  └── Batch Processing   → Handle bulk operations                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Connected AI Services:                                                     │
│  ├── REZ-predictive-engine (4123) → Churn, LTV, conversion               │
│  ├── REZ-recommendation-engine → Product/content recommendations        │
│  ├── REZ-personalization-engine → Feed ordering, UI preferences          │
│  ├── REZ-identity-graph (4050)  → Identity resolution                   │
│  └── REZ-signal-aggregator (4121) → Signal aggregation                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/ai/*, /api/predict, /api/recommend, /api/personalize      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Unified AI Request

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/request` | POST | Unified AI request (predict/recommend/personalize/analyze) |
| `/api/ai/status` | GET | Status of all connected AI services |

### Prediction

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/predict` | POST | Get user predictions (churn, LTV, conversion, revisit) |

**Request:**
```json
{
  "userId": "user_123",
  "type": "churn"
}
```

**Response:**
```json
{
  "userId": "user_123",
  "predictions": {
    "probability": 0.15,
    "risk": "low"
  },
  "model": "REZ-predictive-engine"
}
```

### Recommendation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recommend` | POST | Get personalized recommendations |

**Request:**
```json
{
  "userId": "user_123",
  "category": "product",
  "limit": 10
}
```

**Response:**
```json
{
  "userId": "user_123",
  "recommendations": [
    { "id": "rec_123", "type": "product", "score": 0.9, "reason": "Based on your browsing history" }
  ],
  "model": "REZ-recommendation-engine"
}
```

### Personalization

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/personalize` | POST | Get personalized content and UI |

### Analysis

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Analyze user segments, affinities, sentiment |

### Identity

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/identity/resolve` | POST | Resolve user identity across devices |

### Signals

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/signals` | POST | Submit behavioral signals |

### Batch Processing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/batch` | POST | Process multiple AI requests in batch |

---

## Data Models

### AIRequest

```typescript
interface AIRequest {
  userId: string;
  context: string;
  action: 'predict' | 'recommend' | 'personalize' | 'analyze';
  data?: Record<string, unknown>;
}
```

### AIRecommendation

```typescript
interface AIRecommendation {
  id: string;
  type: string;
  score: number;
  reason: string;
  action?: string;
}
```

---

## Connected AI Services

| Service | URL | Capabilities |
|---------|-----|-------------|
| `REZ-predictive-engine` | localhost:4123 | Churn, LTV, conversion, revisit |
| `REZ-recommendation-engine` | localhost:3001 | Product, content recommendations |
| `REZ-personalization-engine` | localhost:3002 | Feed ordering, UI preferences |
| `REZ-identity-graph` | localhost:4050 | Cross-device identity |
| `REZ-signal-aggregator` | localhost:4121 | Signal aggregation |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "axios": "^1.6.0",
  "zod": "^3.22.4",
  "uuid": "^9.0.0",
  "winston": "^3.11.0"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4101 | Service port |
| `PREDICTIVE_URL` | http://localhost:4123 | Predictive engine URL |
| `RECOMMENDATION_URL` | http://localhost:3001 | Recommendation engine URL |
| `PERSONALIZATION_URL` | http://localhost:3002 | Personalization engine URL |
| `IDENTITY_URL` | http://localhost:4050 | Identity graph URL |
| `SIGNAL_URL` | http://localhost:4121 | Signal aggregator URL |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-predictive-engine | Read | ML predictions |
| REZ-recommendation-engine | Read | Recommendations |
| REZ-personalization-engine | Read | Personalization |
| REZ-identity-graph | Read | Identity resolution |
| REZ-signal-aggregator | Write | Signal ingestion |

---

## Status

- [x] Unified AI request routing
- [x] Service discovery
- [x] Prediction endpoints
- [x] Recommendation endpoints
- [x] Personalization endpoints
- [x] Identity resolution
- [x] Signal submission
- [x] Batch processing
- [ ] Response caching
- [ ] Circuit breaker
- [ ] Request tracing
