# REZ Karma-Loyalty Bridge - SPEC.md

**Version:** 1.0.0
**Port:** 4098
**Company:** REZ-Intelligence
**Category:** Loyalty Integration

---

## Overview

Critical integration bridge connecting Karma (social impact rewards) to RABTUL Unified Loyalty (universal REZ coins). Converts Karma points to spendable coins with tier-based multipliers and score bonuses.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              REZ Karma-Loyalty Bridge (4098)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Conversion Flow:                                                          │
│  Karma Action → Karma Points → Conversion Rate → Tier Multiplier          │
│                                    ↓                                       │
│                        REZ Coins → Wallet → Spend Anywhere                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Action-based conversion rates                                       │
│  ├── Tier multipliers (Bronze → Platinum)                               │
│  ├── Karma score bonuses                                                │
│  └── Batch processing                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Conversion Rates

| Action | Rate | Description |
|--------|------|-------------|
| `checkin` | 10% | QR/GPS check-in |
| `donation` | 15% | Charitable donations |
| `share` | 5% | Social sharing |
| `review` | 10% | Review posted |
| `mission` | 20% | Mission completed |
| `streak` | 25% | Streak bonus |

---

## Tier Multipliers

| Tier | Multiplier | Karma Threshold |
|------|------------|-----------------|
| BRONZE | 1.0x | 0 |
| SILVER | 1.25x | 450 |
| GOLD | 1.5x | 600 |
| PLATINUM | 2.0x | 750 |

---

## API Endpoints

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |

### Conversion

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/convert/preview` | POST | Preview conversion |
| `/api/v1/convert` | POST | Convert karma to coins |
| `/api/v1/convert/batch` | POST | Batch conversion |

### History

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/conversions/:userId` | GET | Get conversion history |

### Configuration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/config/rates` | GET | Get conversion rates |
| `/api/v1/config/rates` | PUT | Update conversion rates |

---

## API Examples

### Preview Conversion

**Request:**
```json
{
  "karmaPoints": 100,
  "actionType": "mission",
  "karmaScore": 650
}
```

**Response:**
```json
{
  "karmaPoints": 100,
  "actionType": "mission",
  "karmaScore": 650,
  "tier": "GOLD",
  "baseRate": 0.2,
  "tierMultiplier": 1.5,
  "scoreBonus": 10,
  "rezCoins": 30.0,
  "breakdown": {
    "baseCoins": 20.0,
    "afterTier": 30.0,
    "afterScore": 33.0
  }
}
```

### Convert Karma Points

**Request:**
```json
{
  "userId": "user_123",
  "karmaUserId": "karma_456",
  "karmaPoints": 100,
  "actionType": "mission",
  "karmaScore": 650
}
```

**Response:**
```json
{
  "success": true,
  "conversion": {
    "id": "conv_abc123",
    "userId": "user_123",
    "karmaPoints": 100,
    "rezCoins": 30.0,
    "status": "completed"
  },
  "message": "100 Karma points → 30 REZ Coins",
  "nextTier": {
    "nextTier": "PLATINUM",
    "coinsNeeded": 100
  }
}
```

---

## Data Models

### KarmaAction

```typescript
interface KarmaAction {
  type: 'checkin' | 'donation' | 'share' | 'review' | 'mission' | 'streak';
  karmaPoints: number;
  rezCoins: number;
  description: string;
}
```

### ConversionRecord

```typescript
interface ConversionRecord {
  id: string;
  userId: string;
  karmaUserId: string;
  action: string;
  karmaPoints: number;
  rezCoins: number;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
}
```

### BridgeConfig

```typescript
interface BridgeConfig {
  conversionRates: Record<string, number>;
  tierMultipliers: Record<string, number>;
  scoreThresholds: Record<string, number>;
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "axios": "^1.6.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4098 | Service port |
| `RABTUL_URL` | http://localhost:4004 | RABTUL wallet URL |
| `KARMA_URL` | http://localhost:3009 | Karma service URL |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| RABTUL Wallet | Write | Add coins to user wallet |
| Karma Service | Read | Read karma scores |
| Analytics | Write | Track conversions |

---

## Conversion Formula

```
coins = karmaPoints × baseRate × tierMultiplier × (1 + scoreBonus)
```

Where:
- `baseRate` = action-specific conversion rate
- `tierMultiplier` = user's Karma tier bonus
- `scoreBonus` = +5% per 100 karma points above 450 (max 50%)

---

## Status

- [x] Karma to REZ coins conversion
- [x] Tier-based multipliers
- [x] Score-based bonuses
- [x] Conversion preview
- [x] Batch processing
- [x] Configurable rates
- [ ] Real-time sync with Karma service
- [ ] RABTUL wallet integration
- [ ] Conversion analytics dashboard
