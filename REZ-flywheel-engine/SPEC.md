# REZ Flywheel Engine - SPEC.md

**Version:** 1.0.0
**Port:** 4110
**Company:** REZ-Intelligence
**Category:** Growth Automation

---

## Overview

Growth flywheel engine that creates compounding value loops for the REZ ecosystem. Drives network effects by connecting user actions to ecosystem growth, creating self-reinforcing growth cycles.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REZ Flywheel Engine (4110)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Flywheel Concepts:                                                         │
│  ├── Input   → User actions, transactions, engagement                      │
│  ├── Process → Value creation, referrals, rewards                          │
│  ├── Output  → Growth, retention, network effects                         │
│  └── Loop    → Output feeds back as new input                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Flywheel Types:                                                           │
│  ├── User → Value → Referral → More Users                                 │
│  ├── Merchant → Sales → Data → Better Matching → More Sales               │
│  ├── Content → Engagement → Creators → More Content                       │
│  └── Ads → Revenue → Better Inventory → More Ads                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Flywheel Categories

### User Growth Flywheel

```
New User Signup
      ↓
Personalized Experience (AI)
      ↓
High Engagement
      ↓
Successful Transactions
      ↓
Rewards & Referral Incentive
      ↓
User Refers Friends
      ↓
More Users (loop continues)
```

### Merchant Value Flywheel

```
Merchant Onboarding
      ↓
Transaction Data
      ↓
Better Matching (AI)
      ↓
More Transactions
      ↓
Higher Revenue
      ↓
Better Recommendations (loop continues)
```

### Creator Content Flywheel

```
Creator Publishes Content
      ↓
User Engagement
      ↓
Creator Earnings
      ↓
More Quality Content
      ↓
More Users (loop continues)
```

---

## API Endpoints

### Flywheel Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |

### Flywheel Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/flywheel/status` | GET | Get all flywheel statuses |
| `/api/flywheel/:type/activate` | POST | Activate a flywheel |
| `/api/flywheel/:type/deactivate` | POST | Deactivate a flywheel |

### User Flywheel

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/:userId/progress` | GET | Get user's flywheel progress |
| `/api/user/:userId/rewards` | GET | Get accumulated rewards |

### Merchant Flywheel

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/merchant/:merchantId/analytics` | GET | Get flywheel analytics |
| `/api/merchant/:merchantId/growth` | GET | Get growth metrics |

---

## Flywheel Metrics

| Metric | Description |
|--------|-------------|
| `momentum` | Growth rate of flywheel |
| `velocity` | Speed of value circulation |
| `efficiency` | Input to output ratio |
| `compounding` | Rate of self-reinforcement |

---

## Data Models

### FlywheelState

```typescript
interface FlywheelState {
  type: 'user' | 'merchant' | 'creator' | 'ads';
  active: boolean;
  metrics: {
    momentum: number;
    velocity: number;
    efficiency: number;
  };
  lastUpdated: Date;
}
```

### FlywheelReward

```typescript
interface FlywheelReward {
  userId: string;
  flywheelType: string;
  amount: number;
  reason: string;
  milestone: string;
  createdAt: Date;
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "axios": "^1.6.0",
  "zod": "^3.22.4"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4110 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-flywheel | MongoDB URI |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-recommendation-engine | Read | Personalization |
| REZ-signal-aggregator | Read | Engagement signals |
| RABTUL-wallet-service | Write | Rewards distribution |
| REZ-autonomous-agents | Write | Growth automation |

---

## Growth Mechanics

### Compounding Loops

1. **User Value Loop**: Better recommendations → More engagement → More data → Even better recommendations
2. **Network Effects**: More users → More merchants → Better selection → More users
3. **Data Network**: More transactions → Better AI → Better decisions → More transactions

### Momentum Indicators

| Indicator | Threshold | Action |
|-----------|-----------|--------|
| Momentum > 1.2 | Accelerating | Increase investment |
| Momentum = 1.0 | Stable | Monitor |
| Momentum < 0.8 | Decelerating | Intervention needed |

---

## Status

- [x] Basic flywheel framework
- [ ] User growth flywheel
- [ ] Merchant value flywheel
- [ ] Creator content flywheel
- [ ] Ads revenue flywheel
- [ ] Real-time momentum tracking
- [ ] Automated interventions
- [ ] Flywheel analytics dashboard
