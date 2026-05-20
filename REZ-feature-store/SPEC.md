# REZ Feature Store - SPEC.md

**Version:** 1.0.0
**Port:** 4127/4128
**Company:** REZ-Intelligence
**Category:** ML Infrastructure

---

## Overview

ML feature management system for the REZ ecosystem. Provides feature registration, serving (online/offline), computation, monitoring, and versioning capabilities.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Feature Store (4127/4128)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                              │
│  ├── Feature Registration  → Define features with metadata                  │
│  ├── Feature Groups       → Group related features                        │
│  ├── Online Serving      → Real-time feature retrieval                   │
│  ├── Offline Serving     → Historical feature export                      │
│  ├── Feature Computation → Batch feature calculation                      │
│  └── Feature Monitoring  → Statistics and drift detection                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Entity Types: user, product, merchant                                    │
│  Freshness: realtime, hourly, daily                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Features

### Feature Registration

Register ML features with metadata.

**Feature Schema:**
```json
{
  "name": "user_total_orders_30d",
  "description": "Total orders in last 30 days",
  "entity": "user",
  "data_type": "int",
  "version": "v1.0.0",
  "computed_from": ["orders", "order_items"],
  "transformation": "COUNT(order_id) WHERE date > NOW() - 30d",
  "freshness": "daily"
}
```

### Feature Groups

Group related features for batch serving.

**Group Example:**
```json
{
  "name": "user_behavior_v1",
  "entity": "user",
  "features": [
    "user_total_orders_30d",
    "user_avg_order_value",
    "user_days_since_last_order"
  ],
  "freshness": "daily"
}
```

### Online Serving

Real-time feature retrieval (< 50ms target).

**Request:**
```json
{
  "entity_id": "user_123",
  "features": ["user_total_orders_30d", "user_avg_order_value"]
}
```

**Response:**
```json
{
  "entity_id": "user_123",
  "features": {
    "user_total_orders_30d": 45,
    "user_avg_order_value": 278.50
  },
  "timestamp": "2026-05-20T10:30:00Z"
}
```

### Offline Serving

Historical feature export for training.

**Request:**
```json
{
  "entity_id": "user_123",
  "features": ["user_total_orders_30d"],
  "from": "2026-01-01",
  "to": "2026-05-20"
}
```

---

## API Endpoints

### Feature Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/features` | POST | Register new feature |
| `/api/features` | GET | List all features |
| `/api/features/:name` | GET | Get feature details |
| `/api/features/:name` | DELETE | Delete feature |

### Feature Groups

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/feature-groups` | POST | Create feature group |
| `/api/feature-groups` | GET | List feature groups |
| `/api/feature-groups/:name` | GET | Get feature group |

### Feature Serving

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/serving/online` | POST | Get real-time features |
| `/api/serving/online/batch` | POST | Batch get features |
| `/api/serving/offline` | POST | Get historical features |
| `/api/serving/export` | POST | Export features to S3/GCS |

### Feature Writing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/features/write` | POST | Write feature value |
| `/api/features/write/batch` | POST | Batch write values |

### Feature Computation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/compute` | POST | Trigger computation job |
| `/api/compute/:job_id` | GET | Get job status |

### Monitoring

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/monitor/features` | POST | Get feature statistics |
| `/api/monitor/drift` | GET | Detect feature drift |

---

## Data Models

### Feature

```typescript
interface Feature {
  name: string;
  description: string;
  entity: 'user' | 'product' | 'merchant';
  data_type: 'float' | 'int' | 'string' | 'bool';
  version: string;
  created_at: string;
  computed_from: string[];
  transformation: string;
  freshness: 'realtime' | 'hourly' | 'daily';
}
```

### FeatureValue

```typescript
interface FeatureValue {
  entity_id: string;
  feature_name: string;
  value: any;
  version: string;
  timestamp: string;
}
```

### FeatureGroup

```typescript
interface FeatureGroup {
  name: string;
  entity: 'user' | 'product' | 'merchant';
  features: string[];
  freshness: 'realtime' | 'hourly' | 'daily';
  created_at: string;
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "redis": "^4.6.10",
  "axios": "^1.6.0"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4127/4128 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-feature-store | MongoDB |
| `REDIS_URL` | redis://localhost:6379 | Redis cache |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| Signal Aggregator | Write | User signals features |
| Predictive Engine | Read | ML model features |
| Commerce Graph | Read | Commerce features |
| Recommendation Engine | Read | Recommendation features |

---

## Default Features

### User Features
- `user_total_orders_30d`
- `user_avg_order_value`
- `user_days_since_last_order`
- `user_total_spend`
- `user_first_order_date`
- `user_last_order_date`

### Product Features
- `product_total_sales_7d`
- `product_avg_rating`
- `product_inventory_level`
- `product_price_trend`

### Merchant Features
- `merchant_total_revenue_30d`
- `merchant_avg_order_value`
- `merchant_customer_count`
- `merchant_rating`

---

## Status

- [x] Feature registration
- [x] Feature groups
- [x] Online serving
- [x] Offline serving
- [x] Feature writing
- [x] Feature computation
- [x] Monitoring & drift detection
- [ ] Redis caching
- [ ] Spark/Flink integration
- [ ] S3/GCS export
