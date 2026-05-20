# REZ Attribution-Loyalty Bridge - SPEC.md

**Version:** 1.0.0
**Port:** 4155
**Company:** REZ-Intelligence
**Category:** Attribution

---

## Overview

Bridge service connecting REZ-unified-attribution to REZ-unified-loyalty. Converts attributed conversions into cashback and loyalty rewards with channel-specific multipliers.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               REZ Attribution-Loyalty Bridge                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Flow:                                                                    │
│  Conversion Event → Attribution → Reward Calculation → Cashback/Loyalty  │
│                                                                             │
│  Features:                                                                 │
│  ├── Real-time Bridging → Instant conversion-to-reward                   │
│  ├── Channel Multipliers → Channel-specific reward rates                  │
│  ├── DOOH Bonus (1.5x) → Digital out-of-home bonus                       │
│  ├── Campaign Bonuses → Campaign-based multipliers                        │
│  ├── Idempotent Processing → Prevent duplicate rewards                    │
│  └── Retry Logic → Exponential backoff for failures                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Reward Structure

| Channel | Base Rate | Notes |
|---------|-----------|-------|
| Organic | 5% | Direct traffic |
| Social | 3% | Social media |
| Email | 4% | Email campaigns |
| DOOH | 7.5% | 1.5x bonus applied |
| Search | 4% | Paid search |
| Display | 2% | Banner ads |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/ready` | Readiness probe |
| POST | `/api/v1/attribution` | Process attribution event |
| POST | `/api/v1/cashback` | Calculate cashback |
| POST | `/api/v1/rewards` | Issue loyalty rewards |
| GET | `/api/v1/config` | Get bridge configuration |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "ioredis": "^5.3.0",
  "axios": "^1.6.0",
  "zod": "^3.22.0",
  "helmet": "^7.1.0",
  "winston": "^3.11.0",
  "amqplib": "^0.10.3",
  "uuid": "^9.0.0"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4155 | Service port |
| MONGODB_URI | localhost | MongoDB connection |
| DOOH_BONUS_MULTIPLIER | 1.5 | DOOH bonus rate |
| MAX_CASHBACK_PERCENT | 10 | Max cashback cap |
| CONVERSION_WINDOW_HOURS | 168 | Attribution window (7 days) |
| POLL_ATTRIBUTION | false | Enable polling mode |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-unified-attribution | Read | Conversion events |
| REZ-unified-loyalty | Write | Issue rewards |
| REZ-wallet | Write | Cashback credits |

---

## Status

- [x] Service foundation
- [x] Attribution listener
- [x] Cashback engine
- [x] Reward calculation
- [ ] Campaign multipliers
- [ ] DOOH bonus integration
