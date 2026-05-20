# REZ Realtime Segments - SPEC.md

**Version:** 1.0.0
**Port:** 4126
**Company:** REZ-Intelligence
**Category:** Customer Segmentation

---

## Overview

Real-time customer segmentation with RFM (Recency, Frequency, Monetary) analysis. Evaluates users against segment definitions in real-time with webhook support for segment change notifications.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ Realtime Segments (4126)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core:                                                                    │
│  ├── Segment Engine     → Rule-based segment evaluation                    │
│  ├── Behavior Tracker  → Real-time user behavior                          │
│  ├── Webhook Emitter   → Segment change notifications                     │
│  └── RFM Analyzer      → Recency, Frequency, Monetary analysis           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Default Segments:                                                         │
│  ├── VIP/High-Value    → Top spenders by tier                            │
│  ├── Churned           → No activity in X days                          │
│  ├── New Users         → Joined in last X days                          │
│  ├── Power Users       → High engagement & frequency                      │
│  ├── At-Risk           → Declining engagement                           │
│  └── Win-Back Eligible → Churned but recoverable                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/v1/*                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Default Segments

| Segment ID | Name | Description | Criteria |
|------------|------|-------------|----------|
| `vip` | VIP | Top 1% spenders | totalSpend >= 50000 OR (tier = 'elite' AND orders >= 20) |
| `high-value` | High Value | Top 10% spenders | totalSpend >= 15000 OR (avgOrderValue >= 1000 AND orders >= 10) |
| `loyal` | Loyal | Repeat purchasers | repeatRate >= 0.6 AND orders >= 5 |
| `new-users` | New Users | Recently joined | tenureDays <= 30 |
| `at-risk` | At Risk | Declining engagement | lastActiveDays >= 14 OR (activityTrend < 0.5 AND orders >= 3) |
| `churned` | Churned | Inactive | lastActiveDays >= 60 |
| `power-users` | Power Users | High engagement | engagementScore >= 80 AND orders >= 10 |
| `occasional` | Occasional | Low frequency | orders <= 3 AND tenureDays >= 90 |
| `dormant` | Dormant | Very inactive | lastActiveDays >= 90 |
| `winback-eligible` | Win-Back Eligible | Recoverable churned | lastActiveDays >= 30 AND lastActiveDays <= 90 AND (lifetime.orders >= 3 OR lifetime.totalSpend >= 1000) |

---

## RFM Analysis

### Recency (R)
- **R5**: Active within 7 days
- **R4**: 8-30 days ago
- **R3**: 31-90 days ago
- **R2**: 91-180 days ago
- **R1**: 180+ days ago

### Frequency (F)
- **F5**: 20+ orders
- **F4**: 10-19 orders
- **F3**: 5-9 orders
- **F2**: 2-4 orders
- **F1**: 1 order

### Monetary (M)
- **M5**: ₹50,000+
- **M4**: ₹15,000-49,999
- **M3**: ₹5,000-14,999
- **M2**: ₹1,000-4,999
- **M1**: < ₹1,000

### RFM Score
```
RFM Score = (R × 100) + (F × 10) + M
```
Range: 111 (worst) to 555 (best)

---

## API Endpoints

### GET /api/v1/segments

List all segment definitions.

**Response:**
```json
{
  "success": true,
  "data": {
    "segments": [
      {
        "segmentId": "vip",
        "name": "VIP",
        "description": "Top 1% spenders",
        "ruleCount": 2,
        "estimatedSize": 1500
      }
    ]
  }
}
```

### GET /api/v1/segments/:segmentId

Get segment definition.

**Response:**
```json
{
  "success": true,
  "data": {
    "segmentId": "vip",
    "name": "VIP",
    "description": "Top 1% spenders",
    "rules": [
      { "field": "totalSpend", "operator": ">=", "value": 50000 }
    ],
    "logic": "OR",
    "estimatedSize": 1500,
    "avgMetrics": {
      "ltv": 85000,
      "avgOrderValue": 2500,
      "churnRate": 0.05
    }
  }
}
```

### POST /api/v1/segments/:segmentId/evaluate/:userId

Evaluate user against specific segment.

**Request (optional):**
```json
{
  "userData": {
    "userId": "user_123",
    "lifetime": {
      "totalSpend": 25000,
      "totalOrders": 15,
      "avgOrderValue": 1667,
      "tenureDays": 180
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "segmentId": "high-value",
    "matches": true,
    "matchedRules": ["totalSpend >= 15000"],
    "evaluationTimeMs": 2.5
  }
}
```

### POST /api/v1/segments/evaluate/:userId

Evaluate user against all segments.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "segments": [
      { "segmentId": "high-value", "matches": true },
      { "segmentId": "loyal", "matches": true },
      { "segmentId": "power-users", "matches": false }
    ],
    "totalEvaluations": 10,
    "evaluationTimeMs": 15.3
  }
}
```

### GET /api/v1/segments/:segmentId/members

Get users in segment with pagination.

**Query:** `?page=1&limit=100`

**Response:**
```json
{
  "success": true,
  "data": {
    "segmentId": "vip",
    "members": [
      {
        "userId": "user_123",
        "joinedAt": "2026-01-15",
        "rfmScore": 445,
        "metrics": {
          "totalSpend": 85000,
          "totalOrders": 45,
          "avgOrderValue": 1889
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 1500,
      "totalPages": 15
    }
  }
}
```

### GET /api/v1/segments/:segmentId/stats

Get segment statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "segmentId": "vip",
    "name": "VIP",
    "totalMembers": 1500,
    "newMembersToday": 12,
    "churnedMembersToday": 3,
    "avgMetrics": {
      "ltv": 85000,
      "avgOrderValue": 2500,
      "avgOrdersPerMonth": 3.5,
      "churnRate": 0.05
    },
    "demographics": {
      "avgAge": 35,
      "topCities": ["Mumbai", "Delhi", "Bangalore"]
    }
  }
}
```

### GET /api/v1/users/:userId/segments

Get all segments for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "primarySegment": "vip",
    "segments": [
      { "segmentId": "vip", "score": 0.95 },
      { "segmentId": "loyal", "score": 0.88 }
    ],
    "rfmScore": 445,
    "rfmTier": "R4F4M4"
  }
}
```

---

## Webhook Events

### Segment Change Events

When a user enters or exits a segment, emit webhook:

```json
{
  "event": "segment.member_added",
  "segmentId": "vip",
  "userId": "user_123",
  "timestamp": "2026-05-20T10:30:00Z",
  "metadata": {
    "trigger": "order_completed",
    "newMetrics": { "totalSpend": 52000 }
  }
}
```

---

## Data Models

### UserSegmentData

```typescript
interface UserSegmentData {
  userId: string;
  lifetime: {
    totalSpend: number;
    totalOrders: number;
    avgOrderValue: number;
    tenureDays: number;
  };
  behavior: {
    lastActiveAt: Date;
    lastOrderAt?: Date;
    avgDaysBetweenOrders?: number;
    engagementScore?: number;
    activityTrend?: number;
  };
  rfm: {
    recencyScore: number;    // 1-5
    frequencyScore: number;   // 1-5
    monetaryScore: number;    // 1-5
    combinedScore: number;   // 111-555
  };
  segments: string[];
  updatedAt: Date;
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "ioredis": "^5.3.2",
  "mongoose": "^8.2.0",
  "zod": "^3.22.4",
  "axios": "^1.6.7",
  "uuid": "^9.0.1",
  "winston": "^3.11.0"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4126 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-realtime-segments | MongoDB |
| `REDIS_URL` | redis://localhost:6379 | Redis cache |
| `NODE_ENV` | development | Environment |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| Event Bus | Subscribe | Order events, user activity |
| Commerce Graph | Write | Sync segment memberships |
| Recommendation Engine | Read | Segment-based recommendations |
| Notification Service | Trigger | Segment-based campaigns |
| Care Service | Read | Support prioritization |

---

## Status

- [x] Segment engine
- [x] RFM analysis
- [x] Behavior tracking
- [x] Webhook emitter
- [x] Pagination
- [x] Real-time evaluation
- [ ] Segment overlap analysis
- [ ] Commerce graph sync
