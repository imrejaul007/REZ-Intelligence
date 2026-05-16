# REZ Realtime Segments Service

Real-time user segment evaluation service for the ReZ platform.

## Features

- **Real-time Evaluation**: Evaluate users against segment rules in <100ms
- **Webhook Emissions**: Emit events when users enter/exit segments
- **Redis Caching**: Fast segment membership lookups
- **MongoDB Storage**: Persistent segment definitions and membership history
- **10 Pre-defined Segments**: High spenders, at-risk, loyal customers, and more

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start in development mode
npm run dev

# Or build and start
npm run build
npm start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/status` | Service status |
| GET | `/segments` | List all segments |
| GET | `/segments/:id` | Get segment definition |
| POST | `/segments/:id/evaluate/:userId` | Evaluate user against segment |
| POST | `/segments/evaluate/:userId` | Evaluate user against all segments |
| GET | `/segments/:id/members` | Get segment members (paginated) |
| GET | `/segments/:id/stats` | Segment statistics |
| POST | `/segments/:id/trigger` | Trigger evaluation job |
| GET | `/users/:userId/segments` | Get user's segments |

## Example Usage

```bash
# Evaluate user against all segments
curl -X POST http://localhost:4040/segments/evaluate/user123 \
  -H "Content-Type: application/json" \
  -d '{
    "userData": {
      "userId": "user123",
      "lifetime": {
        "totalSpend": 15000,
        "totalOrders": 15,
        "avgOrderValue": 1000,
        "tenureDays": 365
      },
      "activity": {
        "last30Days": { "orders": 3, "visits": 12 },
        "engagement": { "engagementIndex": 85 }
      },
      "signals": {
        "competitor": { "switchRisk": "LOW", "loyaltyScore": 85 },
        "behavioral": { "cashbackSensitivity": 60, "dealSeeking": 55, "luxuryAffinity": 75 },
        "social": { "influenceTier": "micro" },
        "location": { "segments": ["food_enthusiast"] }
      }
    }
  }'
```

## Pre-defined Segments

| Segment ID | Name | Description |
|------------|------|-------------|
| `high_spender` | High Spenders | Users with high lifetime spend |
| `at_risk` | At Risk | Users with high competitor switch risk |
| `loyal_customer` | Loyal Customers | Users with many orders and high loyalty |
| `power_user` | Power Users | Users with long tenure and high engagement |
| `discount_sensitive` | Discount Sensitive | Users sensitive to cashback and deals |
| `luxury_buyer` | Luxury Buyers | Users with luxury affinity |
| `influencer` | Influencers | Users with social influence |
| `new_customer` | New Customers | Users with tenure <= 30 days |
| `dormant` | Dormant | Users with no recent orders |
| `frequent_visitor` | Frequent Visitors | Users with high visit frequency |

## Webhook Events

The service emits webhooks when users enter or exit segments:

```json
{
  "eventType": "USER_ENTERED_SEGMENT",
  "userId": "user123",
  "segmentId": "high_spender",
  "segmentName": "High Spenders",
  "timestamp": "2026-05-16T10:00:00.000Z",
  "previousMembership": false,
  "currentMembership": true
}
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   API Client    │────▶│  Express Server  │────▶│  Segment Engine │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                               │                          │
                               ▼                          ▼
                        ┌──────────────┐          ┌────────────────┐
                        │    Redis     │          │    MongoDB     │
                        │   (Cache)    │          │ (Persistence)  │
                        └──────────────┘          └────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  Webhooks    │
                        │  (Outbound)  │
                        └──────────────┘
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4040` |
| `NODE_ENV` | Environment | `development` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `MONGODB_URI` | MongoDB URI | `mongodb://localhost:27017/rez-realtime-segments` |
| `INTERNAL_SERVICE_TOKEN` | Auth token | - |
| `WEBHOOK_ENDPOINTS` | Webhook URLs | `[]` |

## License

Proprietary - RTNM Group
