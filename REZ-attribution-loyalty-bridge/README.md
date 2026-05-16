# REZ Attribution-Loyalty Bridge Service

A Node.js microservice that connects **REZ-unified-attribution** to **REZ-unified-loyalty**, automatically converting attributed conversions into cashback and loyalty rewards.

## Features

- **Real-time Conversion Bridging** - Automatically triggers rewards when conversions are attributed
- **Channel-Specific Rewards** - Different coin rates per channel (DOOH: 3, QR: 2, Search: 1.5, etc.)
- **DOOH Bonus** - 1.5x coin multiplier for digital out-of-home attributions
- **Campaign Multipliers** - Configurable bonus multipliers for specific campaigns
- **Multi-Touch Attribution** - Supports First Touch, Last Touch, Linear, Time Decay, Position Based, and Data Driven models
- **Idempotent Processing** - Duplicate events are safely ignored
- **Retry with Exponential Backoff** - Failed transactions are automatically retried (up to 3 times)
- **Real-time Notifications** - Users receive push notifications when they earn rewards
- **Comprehensive Analytics** - Track rewards by channel, merchant, campaign, and time period

## Architecture

```
REZ-unified-attribution
         │
         │ Webhook / Polling
         ▼
┌─────────────────────────────┐
│  Attribution-Loyalty Bridge  │
│         (Port 4040)          │
├─────────────────────────────┤
│  AttributionListener        │
│  ├─ Webhook endpoint        │
│  └─ Polling fallback        │
├─────────────────────────────┤
│  CashbackEngine             │
│  ├─ Channel rates           │
│  ├─ Attribution weights     │
│  └─ Campaign multipliers    │
├─────────────────────────────┤
│  LoyaltyTrigger             │
│  ├─ Wallet credit           │
│  ├─ Cashback award          │
│  └─ Notification dispatch   │
└─────────────────────────────┘
         │
         ▼
REZ-unified-wallet / REZ-unified-loyalty
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 6.0
- Redis (optional, for idempotency caching)

### Installation

```bash
cd REZ-attribution-loyalty-bridge
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `4040` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/rez-attribution-loyalty-bridge` |
| `REDIS_URL` | Redis connection string (optional) | - |
| `ATTRIBUTION_SERVICE_URL` | Attribution service URL | `http://localhost:4090` |
| `WALLET_SERVICE_URL` | Wallet service URL | `http://localhost:4002` |
| `NOTIFICATION_SERVICE_URL` | Notification service URL | `http://localhost:4004` |
| `INTERNAL_SERVICE_TOKEN` | Service-to-service auth token | - |
| `DOOH_BONUS_MULTIPLIER` | DOOH bonus multiplier | `1.5` |
| `MAX_CASHBACK_PERCENT` | Maximum cashback percentage | `10` |
| `CHANNEL_BASE_REWARDS_JSON` | Channel reward rates (JSON) | See defaults |
| `CAMPAIGN_MULTIPLIERS_JSON` | Campaign multipliers (JSON) | - |

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health check |
| `GET` | `/ready` | Readiness check (includes DB) |
| `GET` | `/api/v1/status` | Detailed service status |

### Cashback Calculation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/calculate` | Calculate cashback for a conversion |
| `POST` | `/api/v1/calculate-and-trigger` | Calculate and immediately trigger reward |

### Bridge Records

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/bridges` | List bridge records (with filtering) |
| `GET` | `/api/v1/bridges/:bridgeId` | Get specific bridge record |
| `POST` | `/api/v1/bridges/:bridgeId/trigger` | Manually trigger reward |
| `POST` | `/api/v1/bridges/:bridgeId/retry` | Retry failed record |
| `DELETE` | `/api/v1/bridges/:bridgeId` | Cancel bridge record |

### Conversions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/conversions/process` | Process conversion webhook |
| `POST` | `/api/v1/conversions/:id/reprocess` | Reprocess a conversion |

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/campaigns` | List campaigns |
| `POST` | `/api/v1/campaigns` | Create campaign |
| `GET` | `/api/v1/campaigns/:id` | Get campaign details |
| `PATCH` | `/api/v1/campaigns/:id` | Update campaign |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/analytics/summary` | Overall analytics summary |
| `GET` | `/api/v1/analytics/merchant/:id` | Merchant-specific analytics |

### Batch Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/batch/process-pending` | Process pending records |

## Usage Examples

### Calculate Cashback

```bash
curl -X POST http://localhost:4040/api/v1/calculate \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "conversionId": "conv_123",
    "customerId": "cust_456",
    "merchantId": "merchant_789",
    "orderValue": 500,
    "currency": "INR",
    "channels": ["dooh", "qr"],
    "campaignId": "summer_sale",
    "attributionModel": "last_touch"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "bridgeId": "uuid-xxx",
    "totalCoins": 36.75,
    "totalCashback": 3.67,
    "channelCalculations": [
      {
        "channel": "dooh",
        "attributedRevenue": 500,
        "percentage": 100,
        "baseCoins": 15,
        "bonusMultiplier": 2.25,
        "finalCoins": 33.75,
        "cashbackAmount": 3.37
      },
      {
        "channel": "qr",
        "attributedRevenue": 0,
        "percentage": 0,
        "baseCoins": 0,
        "bonusMultiplier": 1,
        "finalCoins": 0,
        "cashbackAmount": 0
      }
    ],
    "campaignMultiplier": 1.5
  }
}
```

### Process Webhook from Attribution Service

```bash
curl -X POST http://localhost:4040/api/v1/conversions/process \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "event": "conversion.created",
    "timestamp": "2026-05-15T10:30:00Z",
    "data": {
      "conversionId": "conv_123",
      "customerId": "cust_456",
      "merchantId": "merchant_789",
      "status": "completed",
      "type": "purchase",
      "value": { "amount": 500, "currency": "INR" },
      "channels": ["dooh", "qr"],
      "attributionModel": "last_touch",
      "campaignId": "summer_sale"
    }
  }'
```

## Channel Reward Rates

| Channel | Base Coins / 100 INR | Bonus Multiplier |
|---------|---------------------|------------------|
| DOOH | 3 | 1.5 (stackable with DOOH bonus) |
| QR | 2 | 1.0 |
| Referral | 3 | 1.0 |
| Creator | 2.5 | 1.25 |
| Search | 1.5 | 1.0 |
| Social | 1.5 | 1.0 |
| Email | 1 | 1.0 |
| SMS | 1 | 1.0 |
| Organic | 1 | 1.0 |
| Direct | 0.5 | 1.0 |

### DOOH Special Bonus

DOOH (Digital Out-of-Home) attributions receive a **1.5x multiplier** on top of their standard bonus multiplier, making them the highest-paying channel.

Example calculation for 500 INR DOOH order:
- Base coins: (500 / 100) * 3 = 15
- Channel bonus: 15 * 1.25 = 18.75
- DOOH bonus: 18.75 * 1.5 = 28.125 coins

## Attribution Models

The service supports all standard attribution models:

| Model | Description |
|-------|-------------|
| `first_touch` | All credit to first touchpoint |
| `last_touch` | All credit to last touchpoint |
| `last_non_direct` | All credit to last non-direct touchpoint |
| `linear` | Equal credit across all touchpoints |
| `time_decay` | More recent touchpoints get more credit |
| `position_based` | 40% first, 40% last, 20% distributed |
| `data_driven` | Uses attributed revenue if provided |

## Campaign Configuration

Create campaigns to apply bonus multipliers:

```json
{
  "campaignId": "summer_sale",
  "name": "Summer Sale 2026",
  "rewardMultiplier": 1.5,
  "startDate": "2026-05-01T00:00:00Z",
  "endDate": "2026-08-31T23:59:59Z",
  "eligibleChannels": ["dooh", "qr", "social"],
  "maxBonusCoins": 1000,
  "budget": 50000
}
```

## Monitoring

### Health Checks

```bash
# Basic health
curl http://localhost:4040/health

# Detailed status
curl http://localhost:4040/api/v1/status
```

### Analytics

```bash
# Summary analytics
curl http://localhost:4040/api/v1/analytics/summary?startDate=2026-05-01

# By merchant
curl http://localhost:4040/api/v1/analytics/merchant/merchant_789
```

## Error Handling

The service implements automatic retry with exponential backoff:

- **Attempt 1**: Immediate
- **Attempt 2**: 10 minutes delay
- **Attempt 3**: 20 minutes delay
- **Attempt 4**: 40 minutes delay (max)

After 3 failed attempts, the record is marked as permanently failed and requires manual intervention.

## License

Proprietary - RABTUL Technologies
