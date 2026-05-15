# REZ Unified Profile Service

Single source of truth for user profiles, combining identity data, CDP data, signal scores, segment memberships, and activity timelines.

## Overview

The Unified Profile Service aggregates data from multiple services to create a comprehensive view of each user:

- **Identity Data** - From REZ-identity-graph (emails, phones, devices, linked accounts)
- **CDP Data** - From REZ-cdp-service (demographics, preferences)
- **Signal Scores** - Aggregated from location, behavioral, social, and competitor signal services
- **Segment Memberships** - User segment classifications
- **Activity Timeline** - Historical activity and engagement metrics
- **Lifetime Metrics** - Order history, spend, LTV predictions

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 6+
- Access to signal services (or they will use default values)

### Installation

```bash
cd REZ-unified-profile
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4060 | Service port |
| `MONGODB_URI` | `mongodb://localhost:27017/rez-unified-profile` | MongoDB connection |
| `INTERNAL_SERVICE_TOKEN` | - | Service authentication token |
| `LOCATION_SERVICE_URL` | `http://localhost:4115` | Location signals service |
| `BEHAVIORAL_SERVICE_URL` | `http://localhost:4110` | Behavioral signals service |
| `SOCIAL_SERVICE_URL` | `http://localhost:4116` | Social signals service |
| `COMPETITOR_SERVICE_URL` | `http://localhost:4117` | Competitor signals service |

### Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Profile Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/profile/:userId` | Get full unified profile |
| `GET` | `/api/profile/:userId/signals` | Get signal scores only |
| `GET` | `/api/profile/:userId/segments` | Get segment memberships |
| `GET` | `/api/profile/:userId/activity` | Get activity summary |
| `POST` | `/api/profile/:userId/enrich` | Enrich profile with data |
| `DELETE` | `/api/profile/:userId` | Delete a profile |

### Merge Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/profile/merge` | Merge multiple profiles |

### Search Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/profiles/search` | Search profiles with filters |
| `POST` | `/api/profiles/lookup` | Lookup profile by identifier |

### Segment Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/segments/:segment/members` | Get users in a segment |
| `GET` | `/api/segments/stats` | Get segment statistics |
| `PATCH` | `/api/profile/:userId/segments` | Update user segments |

### Health & Info

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health check |
| `GET` | `/ready` | Readiness check |
| `GET` | `/` | Service information |

## API Examples

### Get Profile

```bash
curl -X GET http://localhost:4060/api/profile/user123 \
  -H "X-Internal-Token: your-token"
```

### Enrich Profile

```bash
curl -X POST http://localhost:4060/api/profile/user123/enrich \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "identity",
    "data": {
      "emails": ["user@example.com"],
      "trustScore": 85
    }
  }'
```

### Search Profiles

```bash
curl -X GET "http://localhost:4060/api/profiles/search?segment=high-value&minLifetimeValue=10000" \
  -H "X-Internal-Token: your-token"
```

### Merge Profiles

```bash
curl -X POST http://localhost:4060/api/profile/merge \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "primaryUserId": "user123",
    "secondaryUserIds": ["user456", "user789"],
    "strategy": "latest-wins"
  }'
```

## Profile Structure

```typescript
interface UnifiedProfile {
  userId: string;
  identity: {
    primaryId: string;
    emails: string[];
    phones: string[];
    devices: string[];
    linkedAccounts: LinkedAccount[];
    trustScore: number;
  };
  demographics: {
    name?: string;
    age?: number;
    gender?: string;
    city?: string;
    pincode?: string;
    language?: string;
    occupation?: string;
    incomeTier?: string;
  };
  signals: {
    location: LocationSignals;
    behavioral: BehavioralSignals;
    social: SocialSignals;
    competitor: CompetitorSignals;
    overall: number;
  };
  segments: string[];
  lifetime: {
    tenureDays: number;
    totalOrders: number;
    totalSpend: number;
    avgOrderValue: number;
    lastOrderDate?: Date;
    firstOrderDate?: Date;
    predictedLTV: number;
  };
  activity: {
    last30Days: ActivityPeriod;
    last90Days: ActivityPeriod;
    engagement: EngagementMetrics;
  };
  preferences: UserPreferences;
  lastUpdated: Date;
  createdAt: Date;
}
```

## Signal Aggregation

The service aggregates signals from multiple specialized services:

| Service | URL | Data Provided |
|---------|-----|---------------|
| Location Service | `localhost:4115` | Location segments, patterns, favorite zones |
| Behavioral Service | `localhost:4110` | Buyer type, cashback sensitivity, luxury affinity |
| Social Service | `localhost:4116` | Influence tier, referrals, sharing rate |
| Competitor Service | `localhost:4117` | Loyalty score, switch risk, win-back potential |

If a signal service is unavailable, default values are used to ensure the profile remains functional.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REZ Unified Profile                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   Express   │  │  MongoDB    │  │  Signal     │           │
│  │   Server    │  │  (Mongoose) │  │  Aggregator │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│        │                │                 │                 │
│        └────────────────┴─────────────────┘                 │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   Location    │  │  Behavioral   │  │    Social     │
│   Service     │  │   Service     │  │   Service     │
└───────────────┘  └───────────────┘  └───────────────┘
```

## Error Handling

All errors return a consistent format:

```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed message (dev mode only)"
}
```

## License

Proprietary - RABTUL Technologies
