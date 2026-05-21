# REZ ML Feature Store - SPEC.md

**Version:** 1.0.0
**Port:** 3005
**Company:** REZ-Intelligence
**Category:** ML Infrastructure

---

## Overview

ML Feature Store serving machine learning features for user, merchant, transaction, and behavioral data. Provides low-latency feature retrieval for real-time ML inference and batch feature serving for model training.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ ML Feature Store                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Feature Categories:                                                      │
│  ├── User Features    → Demographics, preferences, segments               │
│  ├── Merchant Features → Performance, ratings, categories                  │
│  ├── Transaction Features → RFM, LTV, velocity                           │
│  └── Behavioral Features → Intent, engagement, patterns                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Serving Modes:                                                          │
│  ├── Online (REST API) → Low-latency inference                           │
│  └── Batch (ETL)      → Model training                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Feature Types

| Category | Examples | Latency Target |
|----------|----------|----------------|
| User | age_group, preference_vector, churn_risk | < 10ms |
| Merchant | avg_rating, fulfillment_rate, category | < 10ms |
| Transaction | rfm_score, ltv_bucket, velocity | < 10ms |
| Behavioral | session_count, browse_depth, intent | < 10ms |

---

## API Endpoints

### Feature Retrieval
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/features/:entityType/:entityId` | Get entity features |
| POST | `/features/batch` | Batch feature retrieval |
| POST | `/features/compute` | Compute derived features |

### Feature Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/features` | Register new feature |
| GET | `/features/catalog` | List available features |
| GET | `/features/:name/metadata` | Feature metadata |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |
| GET | `/ready` | Readiness check |

---

## Dependencies

```json
{
  "express": "^4.18.3",
  "mongoose": "^9.6.1",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "compression": "^1.7.4",
  "morgan": "^1.10.0"
}
```

---

## Data Models

### Feature
```typescript
{
  name: string
  entityType: 'user' | 'merchant' | 'transaction' | 'behavioral'
  dataType: 'number' | 'string' | 'boolean' | 'vector'
  description: string
  defaultValue?: any
  ttl?: number
  createdAt: Date
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Predictive Engine | Read | Model inference |
| REZ Intent Graph | Read | Intent features |
| RABTUL Services | Read | Transaction data |
| REZ Lakehouse | Write | Batch features |

---

## Status

- [x] Feature store foundation
- [x] REST API serving
- [x] Batch feature retrieval
- [x] Feature catalog
- [ ] Real-time streaming
- [ ] Feature monitoring
