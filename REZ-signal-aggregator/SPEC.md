# REZ Signal Aggregator - SPEC.md

**Version:** 1.0.0
**Port:** 4142
**Company:** REZ-Intelligence
**Category:** Signal Processing

---

## Overview

Aggregate signals from multiple sources (location, behavioral, social, competitor, engagement) into unified scoring. Provides real-time signal velocity and segment membership evaluation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REZ Signal Aggregator (4142)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Signal Sources:                                                           │
│  ├── Location Service (:4013)  ─┐                                          │
│  ├── Behavioral Service (:4014) ─┼─→ Weighted Aggregation ─→ Unified Score  │
│  ├── Social Service (:4015) ────┼                                          │
│  ├── Competitor Service (:4016)─┤                                          │
│  └── Engagement Service (:4017)─┘                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Caching: Redis (30s realtime / 5min standard)                             │
│  Storage: MongoDB (UnifiedSignal, SegmentMembership)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Endpoints:                                                                │
│  GET  /signals/:userId              - Unified signals                      │
│  GET  /signals/:userId/summary      - Signal summary                        │
│  GET  /signals/:userId/segments     - Segment memberships                  │
│  GET  /signals/segments/:segment     - Users in segment                    │
│  POST /signals/compute/:userId       - Force recompute                     │
│  GET  /signals/real-time/:userId    - Real-time signals                    │
│  GET  /signals/weights              - Signal weights                       │
│  GET  /signals/segments/list        - Available segments                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Signal Weights

| Signal Type | Weight | Source Service |
|-------------|--------|----------------|
| `behavioral` | 0.25 | Behavioral signals |
| `engagement` | 0.25 | Engagement signals |
| `competitor` | 0.20 | Competitor analysis |
| `location` | 0.15 | Location signals |
| `social` | 0.15 | Social signals |

---

## Scoring Formula

```
Overall Score = (location × 0.15) + (behavioral × 0.25) + (social × 0.15) + (competitor × 0.20) + (engagement × 0.25)
```

**Score Range:** 0-100

---

## Segment Definitions

| Segment | Threshold | Criteria |
|---------|-----------|----------|
| `high-value` | 75 | Overall score >= 75 |
| `medium-value` | 50 | Overall score >= 50 |
| `at-risk` | 40 | Overall score <= 40 |
| `engaged` | 60 | Overall score >= 60 |
| `power-user` | 80 | Engagement score >= 80 |
| `competitor-conscious` | 70 | Competitor score >= 70 |
| `location-sensitive` | 65 | Location score >= 65 |
| `social-butterfly` | 70 | Social score >= 70 |
| `influencer` | 75 | Social >= 75 AND Engagement >= 75 |
| `casual` | 30 | Overall score < 30 |

---

## Data Models

### UnifiedSignal

```typescript
interface UnifiedSignalScore {
  userId: string;
  signals: {
    location: number;
    behavioral: number;
    social: number;
    competitor: number;
    engagement: number;
  };
  overall: number;
  segments: string[];
  computedAt: Date;
}
```

### SegmentMembership

```typescript
interface SegmentMembership {
  userId: string;
  segment: string;
  score: number;
  active: boolean;
  joinedAt: Date;
}
```

### RealTimeSignals

```typescript
interface RealTimeSignals {
  userId: string;
  signals: SignalScores;
  overall: number;
  velocity: {
    location: number;    // 1 = increasing, -1 = decreasing, 0 = stable
    behavioral: number;
    social: number;
    competitor: number;
    engagement: number;
  };
  timestamp: Date;
}
```

---

## API Endpoints

### GET /signals/:userId

Get unified signals for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "signals": {
      "location": 72,
      "behavioral": 85,
      "social": 45,
      "competitor": 60,
      "engagement": 78
    },
    "overall": 70,
    "segments": ["high-value", "engaged", "power-user"],
    "computedAt": "2026-05-20T10:30:00Z"
  }
}
```

### GET /signals/:userId/summary

Get signal summary with top signals.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "overall": 70,
    "topSignals": [
      { "type": "behavioral", "score": 85 },
      { "type": "engagement", "score": 78 },
      { "type": "location", "score": 72 }
    ],
    "segmentCount": 3,
    "lastUpdated": "2026-05-20T10:30:00Z"
  }
}
```

### GET /signals/segments/:segment

Get users in a segment with pagination.

**Query:** `?limit=100&offset=0`

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      { "userId": "user_123", "score": 85, "joinedAt": "2026-05-01T00:00:00Z" }
    ],
    "pagination": {
      "total": 1234,
      "limit": 100,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### GET /signals/real-time/:userId

Get real-time signals with velocity indicators.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "signals": { ... },
    "overall": 70,
    "velocity": {
      "location": 1,
      "behavioral": 0,
      "social": -1,
      "competitor": 0,
      "engagement": 1
    },
    "timestamp": "2026-05-20T10:30:00Z"
  }
}
```

---

## Caching Strategy

| Cache Type | TTL | Purpose |
|-----------|-----|---------|
| Standard Signals | 5 min | Regular API responses |
| Real-time Signals | 30 sec | Fast-fresh signal data |
| Segment Lists | 1 min | User segment lookups |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "ioredis": "^5.3.2",
  "axios": "^1.6.0",
  "winston": "^3.11.0",
  "zod": "^3.22.4"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4142 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-signals | MongoDB |
| `REDIS_URL` | redis://localhost:6379 | Redis cache |
| `CACHE_TTL` | 300 | Standard cache TTL (seconds) |
| `REALTIME_CACHE_TTL` | 30 | Real-time cache TTL (seconds) |
| `INTERNAL_SERVICE_TOKEN` | dev-token | Service authentication |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| Location Service | Pull | Location-based signals |
| Behavioral Service | Pull | Behavior patterns |
| Social Signals | Pull | Social engagement |
| Competitor Service | Pull | Competitor awareness |
| Engagement Service | Pull | App engagement |
| Commerce Graph | Write | Sync segment data |
| Recommendation Engine | Read | Segment-based recs |

---

## Status

- [x] Service implemented
- [x] Signal aggregation logic
- [x] Segment evaluation
- [x] Real-time signals with velocity
- [x] Redis caching
- [x] MongoDB persistence
- [ ] Commerce graph sync
- [ ] Webhook for signal updates
