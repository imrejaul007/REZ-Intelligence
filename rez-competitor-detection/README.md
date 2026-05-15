# REZ Competitor Detection Service

Detect competitor switching behavior, identify switch triggers, and uncover win-back opportunities.

## Service Overview

This service provides:
- **Competitor Switcher Identification** - Identify users likely to switch to competitors
- **Switch Trigger Detection** - Detect signals like price alerts, review drops, and competitor visits
- **Win-Back Opportunity Analysis** - Score and prioritize users for win-back campaigns
- **Competitive Spend Analysis** - Track competitor spending patterns and market share

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start service
npm run dev
```

## API Endpoints

### Profile Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/competitor/:userId` | Get competitor profile |
| GET | `/api/competitor/:userId/signals` | Get switch signals |
| GET | `/api/competitor/:userId/winback` | Get win-back potential |
| POST | `/api/competitor/visit` | Record competitor visit |
| POST | `/api/competitor/detect` | Run detection algorithm |

### Lists & Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/competitor/list/switchers` | Get likely switchers |
| GET | `/api/competitor/list/winback` | Get win-back candidates |
| GET | `/api/competitor/analysis/competitors` | Get competitor analysis |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/competitor/health` | Service health |

## Authentication

All API endpoints require the `X-Internal-Token` header for internal service calls.

```bash
curl -X GET http://localhost:4059/api/competitor/user123 \
  -H "X-Internal-Token: your-token-here"
```

## Data Models

### Competitor Visit

```typescript
{
  competitorId: string;
  competitorName: string;
  category: string;
  visitDate: Date;
  spend: number;
  visitType: 'delivery' | 'dine_in' | 'pickup';
}
```

### Switch Signal

```typescript
{
  type: 'price_alert' | 'review_drop' | 'offer_expired' | 'new_competitor' | 'poor_experience';
  competitorId?: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  description?: string;
}
```

### Win-Back Potential

```typescript
{
  score: number;           // 0-100
  tier: 'hot' | 'warm' | 'cold';
  topTrigger: string;     // Best offer type
  optimalChannel: string; // sms | email | push | whatsapp
  optimalTiming: string;  // immediate | morning | evening | weekend
  competitorsTargeting: string[];
  estimatedValue: number;
  recommendedOffer: string;
}
```

## Detection Algorithms

### Loyalty Score (0-100)
- **Positive factors**: Order frequency, high AOV, recent orders
- **Negative factors**: Competitor share, price alerts, new competitor visits

### Risk Level
- **Critical**: Score < 20, >70% competitor share, 5+ signals
- **High**: Score 20-40, 50-70% competitor share
- **Medium**: Score 40-70, 30-50% competitor share
- **Low**: Score > 70, <30% competitor share

### Win-Back Score
- Base: 100 - loyalty score
- Bonuses: Recent competitor visit (<7 days), high spending, high competitor share

## Configuration

See `.env.example` for available configuration options.

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | 4059 |
| `MONGODB_URI` | MongoDB connection | mongodb://localhost:27017/rez-competitor-detection |
| `INTERNAL_SERVICE_TOKEN` | Auth token | - |
| `RATE_LIMIT_REQUESTS` | Requests per window | 100 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 60000 |

## Running Tests

```bash
npm test
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   REZ Competitor Detection                  │
├─────────────────────────────────────────────────────────────┤
│  Routes Layer                                              │
│  ├── GET /api/competitor/:userId                           │
│  ├── POST /api/competitor/visit                           │
│  └── GET /api/competitor/list/switchers                    │
├─────────────────────────────────────────────────────────────┤
│  Services Layer                                            │
│  ├── CompetitorService (CRUD operations)                   │
│  └── DetectionService (Algorithms)                         │
├─────────────────────────────────────────────────────────────┤
│  Models Layer                                              │
│  └── UserCompetitorProfile (MongoDB)                       │
├─────────────────────────────────────────────────────────────┤
│  Middleware                                                │
│  ├── Auth (Token validation)                               │
│  └── Rate Limiter                                          │
└─────────────────────────────────────────────────────────────┘
```

## License

Proprietary - RTNM Group
