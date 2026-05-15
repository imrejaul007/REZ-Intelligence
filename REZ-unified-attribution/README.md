# REZ Unified Attribution Service

**Port:** 4090

Consolidates all attribution tracking into a single service.

## Features

| Feature | Description |
|---------|-------------|
| **Multi-Touch Attribution** | First, Last, Linear, Time Decay, Position Based, Data Driven |
| **Channel Tracking** | DOOH, QR, Ads, Social, Email, SMS, Push, Organic, Walk-in |
| **Aggregator Attribution** | Swiggy, Zomato, Dunzo |
| **Creator Attribution** | Instagram, YouTube, TikTok |
| **Wallet Attribution** | Cashback tracking |
| **Incrementality Testing** | Holdout, Geo, Temporal |
| **ROI Calculation** | Channel ROI with spend tracking |
| **Cohort Analysis** | Customer cohort attribution |

## Quick Start

```bash
cd REZ-Intelligence/REZ-unified-attribution
npm install
cp .env.example .env
npm run dev
```

## API Endpoints

### Touchpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/track/touchpoint` | Track touchpoint |
| POST | `/api/v1/track/touchpoint/batch` | Batch track |
| GET | `/api/v1/track/touchpoints` | List touchpoints |

### Conversions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/track/conversion` | Track conversion |
| GET | `/api/v1/track/conversions` | List conversions |
| PATCH | `/api/v1/track/conversion/:id/status` | Update status |

### DOOH

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/dooh/impression` | Record impression |
| POST | `/api/v1/dooh/visit` | Record store visit |

### QR

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/qr/scan` | Record QR scan |

### Creator

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/creator/view` | Record view |
| POST | `/api/v1/creator/coupon` | Record coupon usage |

### Aggregator

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/aggregator/order` | Record order |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/reports/attribution` | Attribution report |
| GET | `/api/v1/reports/funnel` | Conversion funnel |
| GET | `/api/v1/reports/dashboard` | Dashboard metrics |

### ROI

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/roi` | Channel ROI |
| GET | `/api/v1/roi/summary` | ROI summary |

## Attribution Models

| Model | Description |
|-------|-------------|
| **FIRST_TOUCH** | 100% credit to first touchpoint |
| **LAST_TOUCH** | 100% credit to last touchpoint |
| **LAST_NON_DIRECT** | Last non-DIRECT touchpoint |
| **LINEAR** | Equal credit to all touchpoints |
| **TIME_DECAY** | Exponential decay (recent = more credit) |
| **POSITION_BASED** | 40% first, 20% middle, 40% last |
| **DATA_DRIVEN** | ML-based (placeholder) |

## Channel Types

| Category | Channels |
|----------|----------|
| **Digital** | search, social, display, video, email, sms, push |
| **Offline** | dooh, print, ooh, walkin |
| **Commerce** | qr, organic, referral, wallet, loyalty, creator, aggregator |
| **Direct** | direct, unknown |

## Example Usage

### Track DOOH Impression

```bash
curl -X POST https://api.rez.money/api/v1/dooh/impression \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merch_123",
    "screenId": "screen_456",
    "customerId": "cust_789",
    "dwellTime": 15
  }'
```

### Track Conversion

```bash
curl -X POST https://api.rez.money/api/v1/track/conversion \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust_789",
    "merchantId": "merch_123",
    "type": "purchase",
    "amount": 500
  }'
```

### Get Attribution Report

```bash
curl "https://api.rez.money/api/v1/reports/attribution?merchantId=merch_123&startDate=2026-05-01&endDate=2026-05-15"
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  REZ Unified Attribution                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │    DOOH    │  │     QR      │  │  Aggregator │         │
│  │  Attribution │  │  Attribution │  │  Attribution │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │           Unified Attribution Engine                       │   │
│  │  • Multi-touch models                                   │   │
│  │  • Channel weighting                                    │   │
│  │  • ROI calculation                                      │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    Reports & Analytics                    │   │
│  │  • Attribution reports    • ROI dashboard                 │   │
│  │  • Funnel analysis      • Cohort tracking               │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
