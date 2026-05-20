# REZ Unified Profile - SPEC.md

**Version:** 1.0.0
**Port:** 4060
**Company:** REZ-Intelligence
**Category:** Identity & Profile

---

## Overview

Single source of truth for user profiles. Aggregates data from all services (RABTUL, Intelligence, Commerce) into a unified view. Provides <50ms profile fetches with real-time updates.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REZ Unified Profile (4060)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Data Sources (aggregated):                                                 │
│  ├── RABTUL Profile Service → Basic info, preferences                      │
│  ├── Signal Aggregator      → Signal scores, segments                      │
│  ├── Predictive Engine      → LTV, churn predictions                       │
│  ├── Commerce Graph         → Relationships, history                       │
│  └── Social Signals         → Social influence, referrals                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Endpoints:                                                                │
│  GET  /profile/:userId            - Full profile                           │
│  GET  /profile/:userId/signals    - Signal data                           │
│  GET  /profile/:userId/segments   - Segment memberships                  │
│  GET  /profile/:userId/activity   - Activity history                      │
│  POST /profile/:userId/enrich     - Enrich profile                        │
│  POST /profile/merge              - Merge profiles                        │
│  GET  /profiles/search            - Search profiles                       │
│  POST /profiles/lookup             - Batch lookup                          │
│  GET  /segments/:segment/members  - Segment members                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Profile Structure

```typescript
interface UnifiedProfile {
  // Identity
  userId: string;
  primaryEmail?: string;
  primaryPhone?: string;
  displayName?: string;
  avatar?: string;

  // Basic Info
  demographics: {
    age?: number;
    gender?: string;
    location?: {
      city?: string;
      state?: string;
      country?: string;
      coordinates?: { lat: number; lng: number };
    };
    language?: string;
    timezone?: string;
  };

  // Intelligence
  signals: {
    location: number;
    behavioral: number;
    social: number;
    competitor: number;
    engagement: number;
    overall: number;
  };
  segments: string[];

  // Predictions
  predictions: {
    ltv?: { value: number; confidence: number };
    churn?: { probability: number; riskLevel: string };
    revisit?: { probability: number; expectedDate: string };
  };

  // Commerce
  commerce: {
    tier?: string;
    totalSpend?: number;
    totalOrders?: number;
    avgOrderValue?: number;
    favoriteCategories?: string[];
    favoriteMerchants?: string[];
  };

  // Social
  social: {
    influenceScore?: number;
    influenceTier?: string;
    referralCount?: number;
    referralConversions?: number;
  };

  // Preferences
  preferences: {
    notifications?: NotificationPrefs;
    marketingConsent?: boolean;
    personalizationLevel?: 'none' | 'basic' | 'full';
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}
```

---

## API Endpoints

### GET /profile/:userId

Get complete unified profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "displayName": "John D.",
    "demographics": {
      "location": { "city": "Mumbai", "country": "India" },
      "language": "en"
    },
    "signals": { "overall": 75, "segments": ["high-value", "engaged"] },
    "predictions": { "ltv": { "value": 12500, "confidence": 0.82 } },
    "commerce": { "tier": "gold", "totalSpend": 8500 },
    "social": { "influenceScore": 45, "influenceTier": "micro" },
    "updatedAt": "2026-05-20T10:30:00Z"
  }
}
```

### GET /profile/:userId/signals

Get signal data for profile.

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
      "engagement": 78,
      "overall": 70
    },
    "segments": ["high-value", "engaged", "power-user"],
    "velocity": { ... },
    "computedAt": "2026-05-20T10:30:00Z"
  }
}
```

### GET /profile/:userId/segments

Get segment memberships.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "segments": [
      { "name": "high-value", "score": 85, "joinedAt": "2026-01-15" },
      { "name": "engaged", "score": 72, "joinedAt": "2026-03-01" },
      { "name": "power-user", "score": 80, "joinedAt": "2026-02-20" }
    ]
  }
}
```

### POST /profile/:userId/enrich

Enrich profile with additional data.

**Request:**
```json
{
  "source": "commerce-graph",
  "data": {
    "recentCategories": ["electronics", "fashion"],
    "seasonalAffinity": { "festive": 0.85 }
  }
}
```

### POST /profile/merge

Merge two profiles (identity resolution).

**Request:**
```json
{
  "primaryUserId": "user_123",
  "secondaryUserId": "user_456",
  "reason": "duplicate-detection",
  "strategy": "primary-wins"
}
```

### GET /profiles/search

Search profiles with filters.

**Query:** `?segments=high-value&limit=20&offset=0`

**Response:**
```json
{
  "success": true,
  "data": {
    "profiles": [ ... ],
    "pagination": { "total": 150, "limit": 20, "offset": 0 }
  }
}
```

### POST /profiles/lookup

Batch profile lookup.

**Request:**
```json
{
  "userIds": ["user_123", "user_456", "user_789"],
  "fields": ["userId", "signals.overall", "commerce.tier"]
}
```

---

## Signal Sources Integration

| Source | Endpoint | Data |
|--------|----------|------|
| Signal Aggregator | `:4142` | Unified signals, segments |
| Predictive Engine | `:4141` | LTV, churn, revisit |
| Commerce Graph | `:4129` | Orders, relationships |
| Social Signals | `:4146` | Influence, referrals |

---

## Caching Strategy

- Profile cache: 5 minutes
- Signal cache: 30 seconds
- Segment cache: 1 minute

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "axios": "^1.6.0",
  "winston": "^3.11.0",
  "zod": "^3.22.4"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4060 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-unified-profile | MongoDB |
| `REDIS_URL` | redis://localhost:6379 | Redis cache |
| `ALLOWED_ORIGINS` | * | CORS origins |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Profile fetch | < 50ms |
| Batch lookup (100) | < 200ms |
| Enrichment | < 100ms |
| Search | < 300ms |

---

## Status

- [x] Profile aggregation
- [x] Signal integration
- [x] Segment membership
- [x] Prediction caching
- [x] Profile search
- [x] Batch lookup
- [x] Profile merge
- [x] Real-time updates
- [ ] DOOH targeting integration
- [ ] Commerce graph bidirectional sync
